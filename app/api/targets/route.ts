import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import type { Target } from "@/lib/types";

export const runtime = "nodejs";

function normalizeHandle(raw: string): string {
  const trimmed = raw.trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : "";
}

// GET /api/targets — all targets, newest first.
export async function GET() {
  const targets = getDb()
    .prepare("SELECT * FROM targets ORDER BY created_at DESC")
    .all() as unknown as Target[];
  return NextResponse.json({ targets });
}

// POST /api/targets — add a target account. { handle, note? }
export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const handle = normalizeHandle(typeof payload?.handle === "string" ? payload.handle : "");
  const note =
    typeof payload?.note === "string" && payload.note.trim() ? payload.note.trim() : null;

  if (!handle) {
    return NextResponse.json({ error: "handle is required" }, { status: 400 });
  }

  const db = getDb();
  try {
    const info = db
      .prepare("INSERT INTO targets (handle, note, created_at) VALUES (?, ?, ?)")
      .run(handle, note, nowIso());
    const target = db
      .prepare("SELECT * FROM targets WHERE id = ?")
      .get(Number(info.lastInsertRowid)) as unknown as Target;
    return NextResponse.json({ target }, { status: 201 });
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return NextResponse.json({ error: "handle already added" }, { status: 409 });
    }
    throw e;
  }
}
