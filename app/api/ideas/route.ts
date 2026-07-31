import { NextResponse } from "next/server";
import { all, get, run, nowIso } from "@/lib/db";
import type { Idea } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/ideas — newest first.
export async function GET() {
  const ideas = await all<Idea>("SELECT * FROM ideas ORDER BY created_at DESC");
  return NextResponse.json({ ideas });
}

// POST /api/ideas — capture a raw thought. { body }
export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";
  if (!body) return NextResponse.json({ error: "body is required" }, { status: 400 });

  const info = await run("INSERT INTO ideas (body, created_at) VALUES (?, ?)", [body, nowIso()]);
  const idea = await get<Idea>("SELECT * FROM ideas WHERE id = ?", [info.lastInsertRowid]);
  return NextResponse.json({ idea }, { status: 201 });
}
