import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import type { ReplyLogEntry } from "@/lib/types";

export const runtime = "nodejs";

function normalizeHandle(raw: string): string {
  const trimmed = raw.trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : "";
}

// GET /api/replies — logged replies, newest first.
export async function GET() {
  const replies = getDb()
    .prepare("SELECT * FROM reply_log ORDER BY created_at DESC")
    .all() as unknown as ReplyLogEntry[];
  return NextResponse.json({ replies });
}

// POST /api/replies — log a reply. { handle?, note? } — both optional.
export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const handle =
    typeof payload?.handle === "string" ? normalizeHandle(payload.handle) || null : null;
  const note =
    typeof payload?.note === "string" && payload.note.trim() ? payload.note.trim() : null;

  const db = getDb();
  const info = db
    .prepare("INSERT INTO reply_log (handle, note, created_at) VALUES (?, ?, ?)")
    .run(handle, note, nowIso());
  const reply = db
    .prepare("SELECT * FROM reply_log WHERE id = ?")
    .get(Number(info.lastInsertRowid)) as unknown as ReplyLogEntry;
  return NextResponse.json({ reply }, { status: 201 });
}
