// Content script: scrapes your own X data and hands it to the service worker,
// which does the (CORS-exempt) fetches to the Cockpit app. All DOM selectors
// come from selectors.js so this file rarely needs to change.
(() => {
  const S = self.COCKPIT_SELECTORS;

  // "1,234" → 1234, "1.2K" → 1200, "3.4M" → 3400000.
  function parseCount(raw) {
    if (!raw) return null;
    const m = String(raw).replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i);
    if (!m) return null;
    let n = parseFloat(m[1]);
    const suf = (m[2] || "").toUpperCase();
    if (suf === "K") n *= 1e3;
    else if (suf === "M") n *= 1e6;
    else if (suf === "B") n *= 1e9;
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  // Read a stat from an action-bar button — aria-label carries the exact number.
  function statFrom(article, selector) {
    const el = article.querySelector(selector);
    if (!el) return null;
    return parseCount(el.getAttribute("aria-label") || el.textContent);
  }

  function readTweetStats(article) {
    const analytics = article.querySelector(S.analyticsLink);
    return {
      body: (article.querySelector(S.tweetText)?.textContent || "").trim(),
      replies: statFrom(article, S.reply),
      reposts: statFrom(article, S.repost),
      likes: statFrom(article, S.like),
      impressions: analytics
        ? parseCount(analytics.getAttribute("aria-label") || analytics.textContent)
        : null,
    };
  }

  function readFollowerCount() {
    for (const a of document.querySelectorAll(S.followerLink)) {
      const n = parseCount(a.textContent);
      if (n != null) return n;
    }
    return null;
  }

  // Ownership guard — only ever capture YOUR followers / YOUR tweets.
  function handleFromHref(href) {
    try {
      return new URL(href, location.origin).pathname.replace(/^\/+/, "").split("/")[0].toLowerCase() || null;
    } catch {
      return null;
    }
  }
  function ownHandle() {
    const a = document.querySelector(S.ownProfileLink);
    return a ? handleFromHref(a.getAttribute("href") || a.href) : null;
  }
  function currentProfileHandle() {
    return location.pathname.replace(/^\/+/, "").split("/")[0].toLowerCase();
  }
  function tweetAuthor(article) {
    const link = article.querySelector(S.tweetAuthorHandle);
    return link ? handleFromHref(link.getAttribute("href") || link.href) : null;
  }

  function toast(msg) {
    const t = document.createElement("div");
    t.textContent = "Cockpit: " + msg;
    Object.assign(t.style, {
      position: "fixed", bottom: "16px", right: "16px", zIndex: "999999",
      background: "#c6f24e", color: "#1a1a1a", padding: "8px 14px",
      borderRadius: "8px", font: "600 13px system-ui",
      boxShadow: "0 6px 20px rgba(0,0,0,.35)",
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  function send(payload) {
    chrome.runtime.sendMessage(payload, (res) => {
      if (chrome.runtime.lastError) return toast("error: " + chrome.runtime.lastError.message);
      toast(res && res.ok ? res.msg || "saved ✓" : "failed: " + ((res && res.error) || "unknown"));
    });
  }

  // ---- Activity capture (Phase 4b) --------------------------------------------
  // Count today's OWN tweets + replies via a two-tab flow:
  //   tweets  = your posts today on /<handle>
  //   total   = your posts today on /<handle>/with_replies
  //   replies = total − tweets
  // State persists in chrome.storage.local so the content script resumes across
  // the two navigations. TTL guards against a stuck/stale run.
  const ACT_KEY = "cockpitActivityCapture";
  const ACT_TTL_MS = 2 * 60 * 1000;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function ymdLocal(d) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  const todayStr = () => ymdLocal(new Date());
  const hereProfilePath = () =>
    location.pathname.toLowerCase().replace(/^\/+/, "").replace(/\/+$/, "");

  // Count your own posts dated today on the current timeline. Auto-scrolls until
  // one of YOUR OWN older posts appears (so today is fully loaded — parent tweets
  // by others are ignored for this gate) or the scroll stalls / hits the cap.
  async function countOwnPostsToday(me) {
    const today = todayStr();
    const seen = new Set();
    let count = 0;
    for (let i = 0; i < 12 && document.querySelectorAll(S.tweet).length === 0; i++) await sleep(400);

    let stable = 0;
    for (let round = 0; round < 30; round++) {
      let passedToday = false;
      for (const art of document.querySelectorAll(S.tweet)) {
        const timeEl = art.querySelector("time");
        const iso = timeEl?.getAttribute("datetime");
        if (!iso) continue;
        const author = tweetAuthor(art);
        if (author !== me) continue; // ignore parents / retweets by others
        const day = ymdLocal(new Date(iso));
        if (day === today) {
          const key = timeEl.closest("a")?.getAttribute("href") || `${author}#${iso}`;
          if (!seen.has(key)) {
            seen.add(key);
            count++;
          }
        } else if (day < today) {
          passedToday = true; // reached your own older posts → today fully loaded
        }
      }
      if (passedToday) break;
      const before = document.querySelectorAll(S.tweet).length;
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(750);
      const after = document.querySelectorAll(S.tweet).length;
      if (after === before) {
        if (++stable >= 3) break; // no new posts loading → end of timeline
      } else stable = 0;
    }
    return count;
  }

  async function resumeActivityCapture() {
    const me = ownHandle();
    if (!me) return;
    const got = await chrome.storage.local.get(ACT_KEY);
    const st = got[ACT_KEY];
    if (!st) return;
    if (Date.now() - st.startedAt > ACT_TTL_MS) {
      await chrome.storage.local.remove(ACT_KEY);
      return;
    }
    const here = hereProfilePath();

    if (st.phase === "need_posts") {
      if (here !== me) return void (location.href = `https://x.com/${me}`);
      toast("counting today's tweets…");
      const tweets = await countOwnPostsToday(me);
      await chrome.storage.local.set({ [ACT_KEY]: { phase: "need_replies", tweets, startedAt: st.startedAt } });
      location.href = `https://x.com/${me}/with_replies`;
    } else if (st.phase === "need_replies") {
      if (here !== `${me}/with_replies`) return void (location.href = `https://x.com/${me}/with_replies`);
      toast("counting today's replies…");
      const total = await countOwnPostsToday(me);
      const replies = Math.max(0, total - (st.tweets || 0));
      await chrome.storage.local.remove(ACT_KEY);
      send({ type: "activity", tweets: st.tweets || 0, replies });
    }
  }

  // ---- Bulk tweet import / metrics refresh (Phase 4c) -------------------------
  // Walk your Posts timeline and collect body + stats for every own tweet within
  // the window, then batch them to the app (match→refresh or create→import).
  const IMP_KEY = "cockpitImportTweets";
  const IMPORT_SINCE_DAYS = 30;

  async function collectMyTweets(me, sinceDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - sinceDays);
    cutoff.setHours(0, 0, 0, 0);
    const seen = new Set();
    const items = [];
    for (let i = 0; i < 12 && document.querySelectorAll(S.tweet).length === 0; i++) await sleep(400);

    let stable = 0;
    for (let round = 0; round < 60; round++) {
      let passed = false;
      for (const art of document.querySelectorAll(S.tweet)) {
        const timeEl = art.querySelector("time");
        const iso = timeEl?.getAttribute("datetime");
        if (!iso) continue;
        const author = tweetAuthor(art);
        if (author !== me) continue; // your own tweets only (skips retweets)
        const key = timeEl.closest("a")?.getAttribute("href") || `${author}#${iso}`;
        if (new Date(iso) >= cutoff) {
          if (!seen.has(key)) {
            seen.add(key);
            const stats = readTweetStats(art);
            if (stats.body) items.push(stats);
          }
        } else {
          passed = true; // reached your own posts older than the window
        }
      }
      if (passed) break;
      const before = document.querySelectorAll(S.tweet).length;
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(800);
      if (document.querySelectorAll(S.tweet).length === before) {
        if (++stable >= 3) break;
      } else stable = 0;
    }
    return items;
  }

  async function resumeImport() {
    const me = ownHandle();
    if (!me) return;
    const got = await chrome.storage.local.get(IMP_KEY);
    const st = got[IMP_KEY];
    if (!st) return;
    if (Date.now() - st.startedAt > ACT_TTL_MS) {
      await chrome.storage.local.remove(IMP_KEY);
      return;
    }
    if (hereProfilePath() !== me) return void (location.href = `https://x.com/${me}`);
    await chrome.storage.local.remove(IMP_KEY);
    toast(`scanning your last ${IMPORT_SINCE_DAYS} days of tweets…`);
    const items = await collectMyTweets(me, IMPORT_SINCE_DAYS);
    if (!items.length) return toast("no tweets found to import");
    toast(`importing ${items.length} tweet${items.length === 1 ? "" : "s"}…`);
    send({ type: "tweets", items });
  }

  function cockpitBtn(label) {
    const btn = document.createElement("button");
    btn.textContent = label;
    Object.assign(btn.style, {
      marginLeft: "8px", cursor: "pointer", border: "1px solid #536471",
      background: "transparent", color: "inherit", borderRadius: "999px",
      padding: "0 10px", font: "600 12px system-ui",
    });
    return btn;
  }

  // Inject an action-bar button per tweet: "→ Cockpit" (save stats) on YOUR tweets,
  // "Reply →" (grab their tweet for the reply-draft flow) on everyone else's.
  function injectButtons() {
    const me = ownHandle();
    if (!me) return; // can't classify own vs. others yet — retry on next mutation
    document.querySelectorAll(S.tweet).forEach((article) => {
      if (article.dataset.cockpit) return;
      const author = tweetAuthor(article);
      if (!author) return; // header not hydrated yet — retry later
      const bar = article.querySelector(S.actionBar);
      if (!bar) return;
      article.dataset.cockpit = "1";

      if (author === me) {
        const btn = cockpitBtn("→ Cockpit");
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const stats = readTweetStats(article);
          if (!stats.body) return toast("couldn't read tweet text (verify selectors)");
          send({ type: "tweet", ...stats });
        });
        bar.appendChild(btn);
      } else {
        const btn = cockpitBtn("Reply →");
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const body = (article.querySelector(S.tweetText)?.textContent || "").trim();
          if (!body) return toast("couldn't read their tweet");
          send({ type: "reply-capture", tweet: body, handle: author });
        });
        bar.appendChild(btn);
      }
    });
  }

  new MutationObserver(() => injectButtons()).observe(document.body, {
    childList: true,
    subtree: true,
  });
  injectButtons();

  // Popup → capture the follower count from the current profile page.
  chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
    if (req && req.type === "capture-activity") {
      const me = ownHandle();
      if (!me) {
        sendResponse({ ok: false, error: "open your X profile (logged in) first" });
        return true;
      }
      chrome.storage.local.set({ [ACT_KEY]: { phase: "need_posts", startedAt: Date.now() } }, () => {
        sendResponse({ ok: true });
        resumeActivityCapture();
      });
      return true;
    }
    if (req && req.type === "import-tweets") {
      const me = ownHandle();
      if (!me) {
        sendResponse({ ok: false, error: "open x.com (logged in) first" });
        return true;
      }
      chrome.storage.local.set({ [IMP_KEY]: { startedAt: Date.now() } }, () => {
        sendResponse({ ok: true });
        resumeImport();
      });
      return true;
    }
    if (req && req.type === "capture-followers") {
      const me = ownHandle();
      const here = currentProfileHandle();
      if (me && here !== me) {
        sendResponse({ ok: false, error: "this is @" + here + ", not you (@" + me + ") — open YOUR profile" });
        return true;
      }
      const n = readFollowerCount();
      if (n == null) {
        sendResponse({ ok: false, error: "follower count not found — open your profile / verify selectors" });
      } else {
        send({ type: "followers", followers: n });
        sendResponse({ ok: true, followers: n });
      }
    }
    return true;
  });

  // On every navigation, resume any pending capture (activity two-tab flow or a
  // tweet import). Polls briefly for the profile link to hydrate before giving up.
  async function bootResume() {
    for (let i = 0; i < 15; i++) {
      const got = await chrome.storage.local.get([ACT_KEY, IMP_KEY]);
      if (!got[ACT_KEY] && !got[IMP_KEY]) return; // nothing pending
      if (ownHandle()) {
        if (got[ACT_KEY]) resumeActivityCapture();
        if (got[IMP_KEY]) resumeImport();
        return;
      }
      await sleep(400);
    }
  }
  bootResume();
})();
