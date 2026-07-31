import { NextResponse } from "next/server";
import { run } from "@/lib/db";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/replies/:id — undo a mis-logged reply.
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const info = await run("DELETE FROM reply_log WHERE id = ?", [Number(id)]);
  if (info.changes === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
