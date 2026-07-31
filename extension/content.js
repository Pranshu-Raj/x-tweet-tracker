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

  // Inject a "→ Cockpit" button into each tweet's action bar.
  function injectButtons() {
    const me = ownHandle();
    document.querySelectorAll(S.tweet).forEach((article) => {
      if (article.dataset.cockpit) return;
      // Only YOUR own tweets get the button (when we can tell who you are).
      if (me && tweetAuthor(article) && tweetAuthor(article) !== me) return;
      const bar = article.querySelector(S.actionBar);
      if (!bar) return;
      article.dataset.cockpit = "1";
      const btn = document.createElement("button");
      btn.textContent = "→ Cockpit";
      Object.assign(btn.style, {
        marginLeft: "8px", cursor: "pointer", border: "1px solid #536471",
        background: "transparent", color: "inherit", borderRadius: "999px",
        padding: "0 10px", font: "600 12px system-ui",
      });
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const stats = readTweetStats(article);
        if (!stats.body) return toast("couldn't read tweet text (verify selectors)");
        send({ type: "tweet", ...stats });
      });
      bar.appendChild(btn);
    });
  }

  new MutationObserver(() => injectButtons()).observe(document.body, {
    childList: true,
    subtree: true,
  });
  injectButtons();

  // Popup → capture the follower count from the current profile page.
  chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
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
})();
