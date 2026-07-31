import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import type { ReplyCapture } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/reply-capture — the most recent captured tweet (or null). The Replies
// page peeks this on mount to prefill the reply-draft flow, then DELETEs it.
export async function GET() {
  const row = (getDb()
    .prepare("SELECT * FROM reply_capture ORDER BY id DESC LIMIT 1")
    .get() as unknown as ReplyCapture | undefined) ?? null;
  return NextResponse.json({ capture: row });
}

// POST /api/reply-capture — store a grabbed tweet. { tweet, handle? }
// Keeps only the latest (clears older ones) so it's a one-slot handoff.
export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const tweet = typeof payload?.tweet === "string" ? payload.tweet.trim() : "";
  if (!tweet) {
    return NextResponse.json({ error: "tweet is required" }, { status: 400 });
  }
  const handle =
    typeof payload?.handle === "string" && payload.handle.trim()
      ? payload.handle.trim().replace(/^@+/, "").replace(/^/, "@")
      : null;

  const db = getDb();
  db.prepare("DELETE FROM reply_capture").run();
  const info = db
    .prepare("INSERT INTO reply_capture (tweet, handle, created_at) VALUES (?, ?, ?)")
    .run(tweet, handle, nowIso());
  const capture = db
    .prepare("SELECT * FROM reply_capture WHERE id = ?")
    .get(Number(info.lastInsertRowid)) as unknown as ReplyCapture;
  return NextResponse.json({ capture }, { status: 201 });
}

// DELETE /api/reply-capture — consume/clear the slot after the page reads it.
export async function DELETE() {
  getDb().prepare("DELETE FROM reply_capture").run();
  return NextResponse.json({ ok: true });
}
