"use client";

import { useEffect, useRef, useState } from "react";
import type { Draft, Target, FollowerEntry } from "@/lib/types";
import { getJson, patchJson, postJson } from "./components/http";
import { todayLocal, isToday } from "@/lib/dates";
import DraftCard from "./components/DraftCard";

const POLL_MS = 60_000;

export default function TodayPage() {
  const [due, setDue] = useState<Draft[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [entries, setEntries] = useState<FollowerEntry[]>([]);
  const [followers, setFollowers] = useState("");
  const [perm, setPerm] = useState<NotificationPermission>("default");
  const [error, setError] = useState("");
  const [today, setToday] = useState("");
  const notified = useRef<Set<number>>(new Set());

  async function load() {
    try {
      const [d, t, g] = await Promise.all([
        getJson<{ drafts: Draft[] }>("/api/drafts?due=1"),
        getJson<{ targets: Target[] }>("/api/targets"),
        getJson<{ entries: FollowerEntry[] }>("/api/growth"),
      ]);
      setDue(d.drafts);
      setTargets(t.targets);
      setEntries(g.entries);
      setError("");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  useEffect(() => {
    load();
    setToday(new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }));
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  // Fire a browser notification once per newly-due draft (tab must be open).
  useEffect(() => {
    if (perm !== "granted" || typeof Notification === "undefined") return;
    for (const d of due) {
      if (!notified.current.has(d.id)) {
        notified.current.add(d.id);
        new Notification("Time to post ⏰", { body: d.body.slice(0, 100) });
      }
    }
  }, [due, perm]);

  async function enableReminders() {
    if (typeof Notification === "undefined") return;
    setPerm(await Notification.requestPermission());
  }

  async function logFollowers() {
    if (followers.trim() === "") return;
    try {
      await postJson("/api/growth", { followers: Number(followers) });
      setFollowers("");
      load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  const toCheck = targets.filter((t) => !isToday(t.last_checked_at));
  const loggedToday = entries.find((e) => e.date === todayLocal());

  return (
    <div>
      <h1 className="page-title">Today</h1>
      <p className="page-sub">
        {today && `${today} — `}what to post, who to reply to, and your daily follower check-in.
      </p>

      {error && (
        <div className="card" style={{ borderColor: "var(--bad)", color: "var(--bad)" }}>
          {error}
        </div>
      )}

      {/* Reminders */}
      <div className="card row spread">
        <div>
          <div style={{ fontWeight: 600 }}>Reminders</div>
          <div className="muted xs">
            {perm === "granted"
              ? "On — notifies you here while this tab is open."
              : "Off — enable to get nudged when a queued tweet is due."}{" "}
            Tab-open only in V1.
          </div>
        </div>
        {perm !== "granted" && (
          <button className="btn btn-accent" onClick={enableReminders}>
            Enable reminders
          </button>
        )}
      </div>

      {/* Due now */}
      <h2 className="section-title">
        Due now <span className="muted small">· {due.length}</span>
      </h2>
      {due.length === 0 ? (
        <div className="empty">Nothing due. Schedule tweets in the Queue to see them here.</div>
      ) : (
        <div className="stack">
          {due.map((d) => (
            <DraftCard key={d.id} draft={d} onMutate={load} />
          ))}
        </div>
      )}

      {/* Reply targets to check */}
      <h2 className="section-title">
        Reply targets to check <span className="muted small">· {toCheck.length}</span>
      </h2>
      {toCheck.length === 0 ? (
        <div className="empty">
          {targets.length === 0
            ? "No targets yet — add accounts on the Replies page."
            : "All caught up. Every target checked today ✓"}
        </div>
      ) : (
        <div className="stack">
          {toCheck.map((t) => (
            <div className="card row spread" key={t.id}>
              <div>
                <span className="mono" style={{ fontWeight: 600 }}>
                  {t.handle}
                </span>
                {t.note && <div className="muted small">{t.note}</div>}
              </div>
              <button
                className="btn"
                onClick={async () => {
                  await patchJson(`/api/targets/${t.id}`, { checked: true });
                  load();
                }}
              >
                Checked
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Follower log nudge */}
      <h2 className="section-title">Follower check-in</h2>
      {loggedToday ? (
        <div className="card row spread">
          <span className="muted small">Logged today</span>
          <span className="score" style={{ fontSize: "var(--text-xl)" }}>
            {loggedToday.followers.toLocaleString()}
          </span>
        </div>
      ) : (
        <div className="card row">
          <span className="muted small">Log today's follower count:</span>
          <input
            className="input"
            type="number"
            min={0}
            placeholder="count"
            value={followers}
            onChange={(e) => setFollowers(e.target.value)}
            style={{ maxWidth: 140 }}
          />
          <button className="btn btn-accent" onClick={logFollowers}>
            Save
          </button>
        </div>
      )}
    </div>
  );
}
