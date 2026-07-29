import { NextResponse } from "next/server";
import { generateReplyDrafts } from "@/lib/ai/reply";

export const runtime = "nodejs";

// POST { tweet, framework? } → { drafts, source }. Uses the configured AI backend;
// with none, returns source "off" (the framework scaffolds remain the fallback).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const tweet = typeof body?.tweet === "string" ? body.tweet : "";
  const framework = typeof body?.framework === "string" ? body.framework : undefined;
  if (!tweet.trim()) {
    return NextResponse.json({ error: "tweet is required" }, { status: 400 });
  }
  return NextResponse.json(await generateReplyDrafts(tweet, framework));
}
