import { NextResponse } from "next/server";
import { all, get, run, nowIso } from "@/lib/db";
import { todayLocal } from "@/lib/dates";
import type { FollowerEntry } from "@/lib/types";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/growth — full series, oldest first.
export async function GET() {
  const entries = await all<FollowerEntry>("SELECT * FROM follower_log ORDER BY date ASC");
  return NextResponse.json({ entries });
}

// POST /api/growth — upsert one day's follower count. { date?, followers, note? }
export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const date = typeof payload?.date === "string" && payload.date ? payload.date : todayLocal();
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  const followers = Number(payload?.followers);
  if (!Number.isFinite(followers) || followers < 0) {
    return NextResponse.json({ error: "followers must be a number ≥ 0" }, { status: 400 });
  }
  const note =
    typeof payload?.note === "string" && payload.note.trim() ? payload.note.trim() : null;

  await run(
    `INSERT INTO follower_log (date, followers, note, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET followers = excluded.followers, note = excluded.note`,
    [date, Math.round(followers), note, nowIso()]
  );

  const entry = await get<FollowerEntry>("SELECT * FROM follower_log WHERE date = ?", [date]);
  return NextResponse.json({ entry });
}
