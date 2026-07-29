import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import type { Idea } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/ideas — newest first.
export async function GET() {
  const ideas = getDb()
    .prepare("SELECT * FROM ideas ORDER BY created_at DESC")
    .all() as unknown as Idea[];
  return NextResponse.json({ ideas });
}

// POST /api/ideas — capture a raw thought. { body }
export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";
  if (!body) return NextResponse.json({ error: "body is required" }, { status: 400 });

  const db = getDb();
  const info = db
    .prepare("INSERT INTO ideas (body, created_at) VALUES (?, ?)")
    .run(body, nowIso());
  const idea = db
    .prepare("SELECT * FROM ideas WHERE id = ?")
    .get(Number(info.lastInsertRowid)) as unknown as Idea;
  return NextResponse.json({ idea }, { status: 201 });
}
