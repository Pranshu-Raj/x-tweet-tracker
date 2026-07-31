import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import { todayLocal } from "@/lib/dates";
import type { DailyActivity } from "@/lib/types";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function intOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

// GET /api/activity — full daily series (oldest first) + today's row (or null).
export async function GET() {
  const db = getDb();
  const entries = db
    .prepare("SELECT * FROM daily_activity ORDER BY date ASC")
    .all() as unknown as DailyActivity[];
  const today = (db
    .prepare("SELECT * FROM daily_activity WHERE date = ?")
    .get(todayLocal()) as unknown as DailyActivity | undefined) ?? null;
  return NextResponse.json({ entries, today });
}

// POST /api/activity — upsert one day's scraped tweet/reply counts.
// { date?, tweets, replies }  (date defaults to today, local)
export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const date =
    typeof payload?.date === "string" && payload.date ? payload.date : todayLocal();
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  const tweets = intOrNull(payload?.tweets);
  const replies = intOrNull(payload?.replies);
  if (tweets === null || replies === null) {
    return NextResponse.json({ error: "tweets and replies must be numbers ≥ 0" }, { status: 400 });
  }

  const db = getDb();
  db.prepare(
    `INSERT INTO daily_activity (date, tweets, replies, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       tweets = excluded.tweets, replies = excluded.replies, updated_at = excluded.updated_at`
  ).run(date, tweets, replies, nowIso());

  const entry = db
    .prepare("SELECT * FROM daily_activity WHERE date = ?")
    .get(date) as unknown as DailyActivity;
  return NextResponse.json({ entry });
}
