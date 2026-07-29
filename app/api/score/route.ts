import { NextResponse } from "next/server";
import { scoreTweet } from "@/lib/score";

// Stateless: grade a tweet's structure. No DB, no key.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  return NextResponse.json(scoreTweet(text));
}
