// ✅ PHASE 0 VERIFIED — all selectors confirmed against live X on 2026-07-31
// (@AICryptoCoder): follower count, tweet text, reply/repost/like/impression stats,
// and the ownership guard all read correctly with no changes needed.
// X changes its DOM without notice, so every fragile selector still lives HERE —
// if capture ever stops working, re-check these first (it's a one-file fix).
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
