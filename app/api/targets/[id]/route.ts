import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import type { Target } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function getTarget(id: number): Target | undefined {
  return getDb().prepare("SELECT * FROM targets WHERE id = ?").get(id) as unknown as Target | undefined;
}

// PATCH — { note?, checked? }. checked:true stamps last_checked_at=now, false clears it.
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const existing = getTarget(Number(id));
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const next: Target = { ...existing };
  if (typeof payload.note === "string") next.note = payload.note.trim() || null;
  if (payload.checked === true) next.last_checked_at = nowIso();
  if (payload.checked === false) next.last_checked_at = null;

  getDb()
    .prepare("UPDATE targets SET note = ?, last_checked_at = ? WHERE id = ?")
    .run(next.note, next.last_checked_at, Number(id));

  return NextResponse.json({ target: getTarget(Number(id)) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const info = getDb().prepare("DELETE FROM targets WHERE id = ?").run(Number(id));
  if (info.changes === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
