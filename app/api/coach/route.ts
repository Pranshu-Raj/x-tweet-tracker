import { NextResponse } from "next/server";
import { get } from "@/lib/db";
import { auditProfile, profileScore } from "@/lib/profile";
import { reviewProfile } from "@/lib/ai/profile";
import type { Profile } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/coach — profile snapshot + objective checklist + score + AI/template review.
export async function GET() {
  const profile =
    (await get<Profile>("SELECT * FROM profile ORDER BY id DESC LIMIT 1")) ?? null;

  if (!profile) {
    return NextResponse.json({
      profile: null,
      checks: [],
      score: 0,
      suggestions: [],
      source: "none",
    });
  }

  const checks = auditProfile(profile);
  const score = profileScore(checks);
  const failed = checks.filter((c) => !c.pass);
  const review = await reviewProfile(profile, failed);

  return NextResponse.json({
    profile,
    checks,
    score,
    suggestions: review.suggestions,
    source: review.source,
  });
}
