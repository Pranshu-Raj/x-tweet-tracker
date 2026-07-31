// ⚠️ PHASE 0 — VERIFY these against live X before trusting the scraper.
// X changes its DOM without notice. Every fragile selector lives HERE so a
// break is a one-file fix. If capture stops working, re-check these first.
self.COCKPIT_SELECTORS = {
  // Profile: the <a> whose href ends in /verified_followers or /followers (its text is the count).
  followerLink: 'a[href$="/verified_followers"], a[href$="/followers"]',
  // A single tweet.
  tweet: 'article[data-testid="tweet"]',
  // Within a tweet:
  tweetText: '[data-testid="tweetText"]',
  actionBar: '[role="group"]', // the reply/repost/like group where we inject our button
  reply: '[data-testid="reply"]',
  repost: '[data-testid="retweet"]',
  like: '[data-testid="like"]',
  analyticsLink: 'a[href$="/analytics"]', // views / impressions link on a tweet
  ownProfileLink: 'a[data-testid="AppTabBar_Profile_Link"]', // left-nav "Profile" → href is /<your-handle>
  tweetAuthorHandle: '[data-testid="User-Name"] a[href^="/"]', // author link in a tweet header
};
