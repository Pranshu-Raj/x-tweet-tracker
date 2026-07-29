import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import type { Draft, DraftStatus } from "@/lib/types";

export const runtime = "nodejs";

const STATUSES: DraftStatus[] = ["draft", "queued", "posted", "archived"];

type Ctx = { params: Promise<{ id: string }> };

function getDraft(id: number): Draft | undefined {
  return getDb().prepare("SELECT * FROM drafts WHERE id = ?").get(id) as unknown as Draft | undefined;
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const draft = getDraft(Number(id));
  if (!draft) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ draft });
}

// PATCH — partial update. Accepts any of: body, status, scheduled_at, posted_at, score,
// impressions, likes, replies. Convenience: setting status='posted' with no posted_at stamps it now.
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const existing = getDraft(Number(id));
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const next: Draft = { ...existing };

  if ("body" in payload) {
    const body = typeof payload.body === "string" ? payload.body.trim() : "";
    if (!body) return NextResponse.json({ error: "body cannot be empty" }, { status: 400 });
    next.body = body;
  }
  if ("status" in payload) {
    if (!STATUSES.includes(payload.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    next.status = payload.status;
  }
  if ("scheduled_at" in payload) {
    next.scheduled_at =
      payload.scheduled_at === null ? null : String(payload.scheduled_at);
  }
  if ("posted_at" in payload) {
    next.posted_at = payload.posted_at === null ? null : String(payload.posted_at);
  }
  if ("score" in payload) {
    next.score =
      typeof payload.score === "number" && Number.isFinite(payload.score)
        ? Math.round(payload.score)
        : null;
  }

  // Manual per-post metrics (learning loop). Each: finite >= 0 → int, null clears.
  for (const key of ["impressions", "likes", "replies"] as const) {
    if (!(key in payload)) continue;
    const v = payload[key];
    if (v === null) {
      next[key] = null;
    } else if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      next[key] = Math.round(v);
    } else {
      return NextResponse.json({ error: `invalid ${key}` }, { status: 400 });
    }
  }

  // Stamp posted_at when a draft is marked posted without an explicit time.
  if (next.status === "posted" && !next.posted_at) {
    next.posted_at = nowIso();
  }

  next.updated_at = nowIso();

  getDb()
    .prepare(
      `UPDATE drafts
       SET body = ?, status = ?, score = ?, scheduled_at = ?, posted_at = ?,
           impressions = ?, likes = ?, replies = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      next.body,
      next.status,
      next.score,
      next.scheduled_at,
      next.posted_at,
      next.impressions,
      next.likes,
      next.replies,
      next.updated_at,
      Number(id)
    );

  return NextResponse.json({ draft: getDraft(Number(id)) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const info = getDb().prepare("DELETE FROM drafts WHERE id = ?").run(Number(id));
  if (info.changes === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
