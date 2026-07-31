// Reminders engine — the single, deterministic source of truth for "what needs
// your attention right now". Pure: no DB, no I/O, no `Date` — everything it needs
// is passed in. That keeps it trivially testable and safe to import anywhere
// (server route AND the local companion daemon). See docs/ROADMAP.md Phase 3.

export type ReminderKind =
  | "due_post"
  | "streak_risk"
  | "post_today"
  | "reply_goal"
  | "targets_unchecked"
  | "follower_log";

export type ReminderPriority = "high" | "medium" | "low";

export interface Reminder {
  id: string; // stable within a day — used to de-dupe notifications
  kind: ReminderKind;
  priority: ReminderPriority;
  title: string; // notification title / panel heading
  body: string; // notification body / panel subtext
  href: string; // where to go to act on it
  count?: number; // optional magnitude (e.g. replies remaining)
}

export interface ReminderInput {
  today: string; // local YYYY-MM-DD (caller supplies — engine stays clock-free)
  dueDrafts: { id: number; body: string }[];
  postsToday: number;
  streak: number;
  todayActive: boolean;
  repliesToday: number;
  replyGoal: number;
  targetsUnchecked: number;
  followerLoggedToday: boolean;
}

const RANK: Record<ReminderPriority, number> = { high: 3, medium: 2, low: 1 };

/** Numeric weight of a priority — higher is more urgent. */
export function priorityRank(p: ReminderPriority): number {
  return RANK[p];
}

/** Compute the active reminders for a moment, ordered most-urgent first. */
export function buildReminders(input: ReminderInput): Reminder[] {
  const out: Reminder[] = [];
  const { today } = input;

  // 🔴 Each queued tweet whose scheduled time has already passed.
  for (const d of input.dueDrafts) {
    const preview = d.body.replace(/\s+/g, " ").trim().slice(0, 100);
    out.push({
      id: `due_post:${d.id}`,
      kind: "due_post",
      priority: "high",
      title: "Time to post ⏰",
      body: preview || "A queued tweet is due.",
      href: "/",
    });
  }

  // 🔴 Streak at risk — nothing logged today and a streak is on the line.
  if (!input.todayActive && input.streak > 0) {
    out.push({
      id: `streak_risk:${today}`,
      kind: "streak_risk",
      priority: "high",
      title: "Streak at risk 🔥",
      body: `Your ${input.streak}-day streak ends if today stays empty — post, reply, or log followers.`,
      href: "/",
    });
  }

  // 🟡 Nothing posted yet today.
  if (input.postsToday === 0) {
    out.push({
      id: `post_today:${today}`,
      kind: "post_today",
      priority: "medium",
      title: "Nothing posted yet today",
      body: "Ship one tweet to keep the habit alive.",
      href: "/compose",
    });
  }

  // 🟡 Daily reply goal not met.
  if (input.repliesToday < input.replyGoal) {
    const left = input.replyGoal - input.repliesToday;
    out.push({
      id: `reply_goal:${today}`,
      kind: "reply_goal",
      priority: "medium",
      title: `Replies ${input.repliesToday}/${input.replyGoal}`,
      body: `${left} more repl${left === 1 ? "y" : "ies"} to hit today's goal.`,
      href: "/replies",
      count: left,
    });
  }

  // 🟡 Reply targets not checked today.
  if (input.targetsUnchecked > 0) {
    const n = input.targetsUnchecked;
    out.push({
      id: `targets_unchecked:${today}`,
      kind: "targets_unchecked",
      priority: "medium",
      title: `${n} reply target${n === 1 ? "" : "s"} to check`,
      body: "Engage with the accounts you're targeting.",
      href: "/replies",
      count: n,
    });
  }

  // 🟢 Follower count not logged today.
  if (!input.followerLoggedToday) {
    out.push({
      id: `follower_log:${today}`,
      kind: "follower_log",
      priority: "low",
      title: "Log today's follower count",
      body: "A 10-second check-in keeps your growth chart honest.",
      href: "/growth",
    });
  }

  // Stable sort: urgent first, insertion order preserved within a tier.
  return out
    .map((r, i) => ({ r, i }))
    .sort((a, b) => RANK[b.r.priority] - RANK[a.r.priority] || a.i - b.i)
    .map(({ r }) => r);
}
