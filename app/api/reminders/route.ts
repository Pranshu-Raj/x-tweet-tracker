import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import { todayLocal, isToday } from "@/lib/dates";
import { computeActivity } from "@/lib/activity";
import { buildReminders } from "@/lib/reminders";
import type { Draft, Target, FollowerEntry } from "@/lib/types";

export const runtime = "nodejs";

const DEFAULT_GOAL = 10;

// GET /api/reminders?goal=N — the prioritized list of what needs attention now.
// The daily reply goal lives client-side (localStorage); callers pass it in.
export async function GET(req: Request) {
  const goalRaw = Number(new URL(req.url).searchParams.get("goal"));
  const replyGoal = Number.isFinite(goalRaw) && goalRaw > 0 ? Math.round(goalRaw) : DEFAULT_GOAL;

  const db = getDb();
  const today = todayLocal();

  const dueDrafts = db
    .prepare(
      `SELECT id, body FROM drafts
       WHERE status = 'queued' AND scheduled_at IS NOT NULL AND scheduled_at <= ?
       ORDER BY scheduled_at ASC`
    )
    .all(nowIso()) as unknown as Pick<Draft, "id" | "body">[];

  const targets = db
    .prepare("SELECT last_checked_at FROM targets")
    .all() as unknown as Pick<Target, "last_checked_at">[];
  const targetsUnchecked = targets.filter((t) => !isToday(t.last_checked_at)).length;

  const followerRow = db
    .prepare("SELECT id FROM follower_log WHERE date = ?")
    .get(today) as unknown as FollowerEntry | undefined;

  const activity = computeActivity();

  const reminders = buildReminders({
    today,
    dueDrafts,
    postsToday: activity.postsToday,
    streak: activity.streak,
    todayActive: activity.todayActive,
    repliesToday: activity.repliesToday,
    replyGoal,
    targetsUnchecked,
    followerLoggedToday: !!followerRow,
  });

  return NextResponse.json({ reminders, generatedAt: nowIso() });
}
