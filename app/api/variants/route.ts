import { NextResponse } from "next/server";
import { generateVariantsSmart } from "@/lib/ai/variants";

export const runtime = "nodejs";

// POST text → hook variants. Uses the configured AI backend if present, else
// falls back to offline templates (see lib/ai/variants.ts). Response includes
// `source` so the UI can show which engine produced them.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  const result = await generateVariantsSmart(text);
  return NextResponse.json(result);
}
