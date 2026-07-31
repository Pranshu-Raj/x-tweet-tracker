// Service worker: the only place that talks to the Cockpit app. With host_permissions
// for localhost, these fetches are CORS-exempt — so the app needs no changes.
const DEFAULT_APP = "http://localhost:3000";

async function appBase() {
  const { appUrl } = await chrome.storage.sync.get("appUrl");
  return (appUrl || DEFAULT_APP).replace(/\/+$/, "");
}

const norm = (s) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();

async function saveFollowers(base, followers) {
  const r = await fetch(base + "/api/growth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ followers }),
  });
  if (!r.ok) throw new Error("growth " + r.status);
  return followers + " followers saved ✓";
}

function metricsOf(t) {
  const m = {};
  if (t.impressions != null) m.impressions = t.impressions;
  if (t.likes != null) m.likes = t.likes;
  if (t.replies != null) m.replies = t.replies;
  return m;
}

async function saveTweet(base, t) {
  if (!t.body) throw new Error("no tweet text");
  const list = await (await fetch(base + "/api/drafts")).json();
  const target = norm(t.body);
  const match = (list.drafts || []).find((d) => norm(d.body) === target);
  const metrics = metricsOf(t);

  if (match) {
    const patch = match.status === "posted" ? metrics : { status: "posted", ...metrics };
    const r = await fetch(base + "/api/drafts/" + match.id, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error("patch " + r.status);
    return "matched draft #" + match.id + " ✓";
  }

  // Not in the app yet — create it as a posted tweet with its metrics.
  const created = await (
    await fetch(base + "/api/drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: t.body }),
    })
  ).json();
  const id = created.draft && created.draft.id;
  if (!id) throw new Error("create failed");
  await fetch(base + "/api/drafts/" + id, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "posted", ...metrics }),
  });
  return "new posted tweet saved ✓";
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      const base = await appBase();
      let m;
      if (msg.type === "followers") m = await saveFollowers(base, msg.followers);
      else if (msg.type === "tweet") m = await saveTweet(base, msg);
      else throw new Error("unknown message");
      sendResponse({ ok: true, msg: m });
    } catch (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
  })();
  return true; // keep the channel open for the async response
});
