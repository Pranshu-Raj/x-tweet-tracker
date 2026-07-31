import { NextResponse } from "next/server";
import { all, get, run, nowIso } from "@/lib/db";
import type { Draft } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/drafts
//   ?status=draft,queued,posted  → filter by status (comma-separated)
//   ?due=1                       → queued drafts whose scheduled time has passed
//   (default)                    → all non-archived, newest first
export async function GET(req: Request) {
  const url = new URL(req.url);
  const due = url.searchParams.get("due");
  const status = url.searchParams.get("status");

  let drafts: Draft[];
  if (due === "1") {
    drafts = await all<Draft>(
      `SELECT * FROM drafts
       WHERE status = 'queued' AND scheduled_at IS NOT NULL AND scheduled_at <= ?
       ORDER BY scheduled_at ASC`,
      [nowIso()]
    );
  } else if (status) {
    const wanted = status.split(",").map((s) => s.trim()).filter(Boolean);
    const placeholders = wanted.map(() => "?").join(",");
    drafts = await all<Draft>(
      `SELECT * FROM drafts WHERE status IN (${placeholders}) ORDER BY created_at DESC`,
      wanted
    );
  } else {
    drafts = await all<Draft>("SELECT * FROM drafts WHERE status != 'archived' ORDER BY created_at DESC");
  }

  return NextResponse.json({ drafts });
}

// POST /api/drafts — create a draft.
export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";
  const score =
    typeof payload?.score === "number" && Number.isFinite(payload.score)
      ? Math.round(payload.score)
      : null;

  if (!body) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const now = nowIso();
  const info = await run(
    "INSERT INTO drafts (body, status, score, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    [body, "draft", score, now, now]
  );

  const draft = await get<Draft>("SELECT * FROM drafts WHERE id = ?", [info.lastInsertRowid]);

  return NextResponse.json({ draft }, { status: 201 });
}
