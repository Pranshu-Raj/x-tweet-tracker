// Activity + streak computation. Shared by /api/streak and /api/reminders so the
// two never drift. Server-only (reads the DB). Day buckets are LOCAL: timestamps
// are stored UTC, but "did I do something today" is a local-calendar question.

import { getDb } from "./db";
import { todayLocal } from "./dates";

/** A Date → local YYYY-MM-DD. */
function fmtLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export interface Activity {
  streak: number;
  todayActive: boolean;
  repliesToday: number;
  replies7d: number;
  posts7d: number;
  postsToday: number;
  ratio: number | null;
}

/** Consecutive-active-day streak plus 7-day and today cadence counts. */
export function computeActivity(): Activity {
  const db = getDb();

  const posted = (
    db.prepare("SELECT posted_at FROM drafts WHERE posted_at IS NOT NULL").all() as unknown as {
      posted_at: string;
    }[]
  ).map((r) => fmtLocal(new Date(r.posted_at)));
  const replies = (
    db.prepare("SELECT created_at FROM reply_log").all() as unknown as { created_at: string }[]
  ).map((r) => fmtLocal(new Date(r.created_at)));
  const followers = (
    db.prepare("SELECT date FROM follower_log").all() as unknown as { date: string }[]
  ).map((r) => r.date);

  // An "active day" = posted a draft, logged a reply, or logged followers.
  const active = new Set<string>([...posted, ...replies, ...followers]);

  const today = todayLocal();
  const todayActive = active.has(today);

  // Count back from today. If today isn't active yet, start at yesterday so an
  // unfinished today doesn't zero out an otherwise-live streak.
  let streak = 0;
  const cursor = new Date();
  if (!todayActive) cursor.setDate(cursor.getDate() - 1);
  while (active.has(fmtLocal(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Last 7 local days, today inclusive.
  const last7 = new Set<string>();
  const c = new Date();
  for (let i = 0; i < 7; i++) {
    last7.add(fmtLocal(c));
    c.setDate(c.getDate() - 1);
  }

  const repliesToday = replies.filter((d) => d === today).length;
  const replies7d = replies.filter((d) => last7.has(d)).length;
  const posts7d = posted.filter((d) => last7.has(d)).length;
  const postsToday = posted.filter((d) => d === today).length;
  const ratio = posts7d === 0 ? null : Math.round((replies7d / posts7d) * 10) / 10;

  return { streak, todayActive, repliesToday, replies7d, posts7d, postsToday, ratio };
}
