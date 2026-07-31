// X Growth Cockpit — reminders daemon (true "always-on", Phase 3).
//
// Polls the running app's /api/reminders and fires native Windows toast
// notifications even when the browser is closed. Zero dependencies: Node's
// global fetch + PowerShell's built-in toast API.
//
//   Run it:   npm run reminders        (keep the app running too)
//   Stop it:  Ctrl+C
//
// Config via env vars (all optional):
//   COCKPIT_URL           app base URL            (default http://localhost:3000)
//   COCKPIT_INTERVAL_MIN  minutes between polls   (default 15)
//   COCKPIT_GOAL          daily reply goal        (default 10)
//   COCKPIT_MIN_PRIORITY  high | medium | low     (default medium — notify medium+)
//   COCKPIT_QUIET_START   hour to go quiet (0-23) (default 22)
//   COCKPIT_QUIET_END     hour to resume  (0-23)  (default 8)
//
// De-dupe: each reminder id fires at most once per local day. State persists to
// scripts/.reminders-state.json so a restart doesn't re-nag you.

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(HERE, ".reminders-state.json");

const APP_URL = (process.env.COCKPIT_URL || "http://localhost:3000").replace(/\/+$/, "");
const INTERVAL_MIN = clampNum(process.env.COCKPIT_INTERVAL_MIN, 15, 1, 1440);
const GOAL = clampNum(process.env.COCKPIT_GOAL, 10, 1, 1000);
const MIN_PRIORITY = ["high", "medium", "low"].includes(process.env.COCKPIT_MIN_PRIORITY || "")
  ? process.env.COCKPIT_MIN_PRIORITY
  : "medium";
const QUIET_START = clampNum(process.env.COCKPIT_QUIET_START, 22, 0, 23);
const QUIET_END = clampNum(process.env.COCKPIT_QUIET_END, 8, 0, 23);
const TOKEN = process.env.COCKPIT_TOKEN || ""; // required only if the app is hosted with auth

const RANK = { high: 3, medium: 2, low: 1 };

function clampNum(raw, def, min, max) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function localDate() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function ts() {
  return new Date().toLocaleTimeString();
}

// Quiet-hours window, midnight-wrap aware (e.g. 22 → 8 spans midnight).
function inQuietHours() {
  if (QUIET_START === QUIET_END) return false;
  const h = new Date().getHours();
  return QUIET_START < QUIET_END
    ? h >= QUIET_START && h < QUIET_END
    : h >= QUIET_START || h < QUIET_END;
}

function loadState() {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    if (s && typeof s.date === "string" && Array.isArray(s.notified)) return s;
  } catch {
    // no state yet — start fresh
  }
  return { date: localDate(), notified: [] };
}

function saveState(state) {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch (e) {
    console.error(`[${ts()}] could not write state: ${e.message}`);
  }
}

// Fire a native Windows toast. Title/body go through env vars, never string
// interpolation, so emoji/quotes/newlines can't break or inject into the script.
function notifyWindows(title, body) {
  const ps = [
    "$ErrorActionPreference='Stop'",
    "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null",
    "[Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null",
    "[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType=WindowsRuntime] | Out-Null",
    "$t=[Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)",
    "$x=$t.GetElementsByTagName('text')",
    "$x.Item(0).AppendChild($t.CreateTextNode($env:TOAST_TITLE)) | Out-Null",
    "$x.Item(1).AppendChild($t.CreateTextNode($env:TOAST_BODY)) | Out-Null",
    "$toast=[Windows.UI.Notifications.ToastNotification]::new($t)",
    // Borrow PowerShell's registered AppUserModelID so the toast reliably shows.
    "$id='{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'",
    "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($id).Show($toast)",
  ].join("\n");

  const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], {
    env: { ...process.env, TOAST_TITLE: title, TOAST_BODY: `${body}\n(X Growth Cockpit)` },
    stdio: "ignore",
    windowsHide: true,
  });
  child.on("error", (e) => console.error(`[${ts()}] toast failed: ${e.message}`));
}

async function tick() {
  let state = loadState();
  const today = localDate();
  if (state.date !== today) {
    state = { date: today, notified: [] };
    saveState(state);
  }

  let payload;
  try {
    const res = await fetch(
      `${APP_URL}/api/reminders?goal=${GOAL}`,
      TOKEN ? { headers: { "x-cockpit-token": TOKEN } } : undefined
    );
    if (!res.ok) {
      console.error(`[${ts()}] app returned HTTP ${res.status}`);
      return;
    }
    payload = await res.json();
  } catch (e) {
    console.error(`[${ts()}] app unreachable at ${APP_URL} (${e.message}) — is it running?`);
    return;
  }

  const reminders = Array.isArray(payload?.reminders) ? payload.reminders : [];

  if (inQuietHours()) {
    console.log(`[${ts()}] quiet hours (${QUIET_START}:00–${QUIET_END}:00) — ${reminders.length} pending, holding`);
    return;
  }

  const wanted = reminders.filter((r) => (RANK[r.priority] || 0) >= RANK[MIN_PRIORITY]);
  const fresh = wanted.filter((r) => !state.notified.includes(r.id));

  if (fresh.length === 0) {
    console.log(`[${ts()}] nothing new (${reminders.length} active, ${wanted.length} at/above ${MIN_PRIORITY})`);
    return;
  }

  for (const r of fresh) {
    notifyWindows(r.title, r.body);
    state.notified.push(r.id);
  }
  saveState(state);
  console.log(`[${ts()}] notified ${fresh.length}: ${fresh.map((r) => r.kind).join(", ")}`);
}

// COCKPIT_ONCE=1 → poll once and exit (for Windows Task Scheduler / testing).
// Otherwise run forever, polling on an interval.
const ONCE = /^(1|true|yes)$/i.test(process.env.COCKPIT_ONCE || "");

if (ONCE) {
  console.log(`Cockpit reminders — single poll → ${APP_URL} (min priority: ${MIN_PRIORITY}).`);
  await tick();
} else {
  console.log(
    `Cockpit reminders daemon → ${APP_URL} every ${INTERVAL_MIN}m ` +
      `(min priority: ${MIN_PRIORITY}, quiet ${QUIET_START}:00–${QUIET_END}:00). Ctrl+C to stop.`
  );
  await tick();
  setInterval(tick, INTERVAL_MIN * 60_000);
}
