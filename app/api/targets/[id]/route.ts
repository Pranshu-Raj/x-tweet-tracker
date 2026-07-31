import { NextResponse } from "next/server";
import { get, run, nowIso } from "@/lib/db";
import type { Target } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function getTarget(id: number): Promise<Target | undefined> {
  return get<Target>("SELECT * FROM targets WHERE id = ?", [id]);
}

// PATCH — { note?, checked? }. checked:true stamps last_checked_at=now, false clears it.
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const existing = await getTarget(Number(id));
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const next: Target = { ...existing };
  if (typeof payload.note === "string") next.note = payload.note.trim() || null;
  if (payload.checked === true) next.last_checked_at = nowIso();
  if (payload.checked === false) next.last_checked_at = null;

  await run("UPDATE targets SET note = ?, last_checked_at = ? WHERE id = ?", [
    next.note,
    next.last_checked_at,
    Number(id),
  ]);

  return NextResponse.json({ target: await getTarget(Number(id)) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const info = await run("DELETE FROM targets WHERE id = ?", [Number(id)]);
  if (info.changes === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
