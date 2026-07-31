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

async function saveActivity(base, tweets, replies) {
  const t = Math.max(0, Math.round(Number(tweets) || 0));
  const r = Math.max(0, Math.round(Number(replies) || 0));
  const res = await fetch(base + "/api/activity", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tweets: t, replies: r }),
  });
  if (!res.ok) throw new Error("activity " + res.status);
  return `today: ${t} tweet${t === 1 ? "" : "s"}, ${r} repl${r === 1 ? "y" : "ies"} ✓`;
}

// Bulk import/refresh: one drafts fetch, then match→PATCH (refresh) or create→PATCH
// (import) per scraped tweet. Same rules as saveTweet, batched to avoid N GETs.
async function saveTweetsBatch(base, items) {
  const list = await (await fetch(base + "/api/drafts")).json();
  const byBody = new Map((list.drafts || []).map((d) => [norm(d.body), d]));
  let created = 0;
  let updated = 0;

  for (const t of items) {
    if (!t || !t.body) continue;
    const metrics = metricsOf(t);
    const match = byBody.get(norm(t.body));
    if (match) {
      const patch = match.status === "posted" ? metrics : { status: "posted", ...metrics };
      const r = await fetch(base + "/api/drafts/" + match.id, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (r.ok) updated++;
    } else {
      const res = await (
        await fetch(base + "/api/drafts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: t.body }),
        })
      ).json();
      const id = res.draft && res.draft.id;
      if (!id) continue;
      await fetch(base + "/api/drafts/" + id, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "posted", ...metrics }),
      });
      byBody.set(norm(t.body), { ...res.draft, status: "posted" }); // dedupe within batch
      created++;
    }
  }
  return `imported ${created} new, updated ${updated} ✓`;
}

async function saveReplyCapture(base, tweet, handle) {
  const res = await fetch(base + "/api/reply-capture", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tweet, handle }),
  });
  if (!res.ok) throw new Error("reply-capture " + res.status);
  return "sent to Cockpit → open Replies ✓";
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      const base = await appBase();
      let m;
      if (msg.type === "followers") m = await saveFollowers(base, msg.followers);
      else if (msg.type === "tweet") m = await saveTweet(base, msg);
      else if (msg.type === "activity") m = await saveActivity(base, msg.tweets, msg.replies);
      else if (msg.type === "tweets") m = await saveTweetsBatch(base, msg.items || []);
      else if (msg.type === "reply-capture") m = await saveReplyCapture(base, msg.tweet, msg.handle);
      else throw new Error("unknown message");
      sendResponse({ ok: true, msg: m });
    } catch (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
  })();
  return true; // keep the channel open for the async response
});
