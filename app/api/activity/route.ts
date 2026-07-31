import { NextResponse } from "next/server";
import { all, get, run, nowIso } from "@/lib/db";
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
  const entries = await all<DailyActivity>("SELECT * FROM daily_activity ORDER BY date ASC");
  const today =
    (await get<DailyActivity>("SELECT * FROM daily_activity WHERE date = ?", [todayLocal()])) ??
    null;
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

  await run(
    `INSERT INTO daily_activity (date, tweets, replies, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       tweets = excluded.tweets, replies = excluded.replies, updated_at = excluded.updated_at`,
    [date, tweets, replies, nowIso()]
  );

  const entry = await get<DailyActivity>("SELECT * FROM daily_activity WHERE date = ?", [date]);
  return NextResponse.json({ entry });
}
