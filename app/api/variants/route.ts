import { NextResponse } from "next/server";
import { generateVariants } from "@/lib/hooks";

// Stateless: turn a raw thought into structured variants. No DB, no key.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  return NextResponse.json({ variants: generateVariants(text) });
}
