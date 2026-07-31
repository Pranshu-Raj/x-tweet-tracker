import { NextResponse } from "next/server";
import { computeActivity } from "@/lib/activity";

export const runtime = "nodejs";

// GET /api/streak — activity streak + 7-day reply/post cadence.
// Computation lives in lib/activity so /api/reminders shares the exact same math.
export async function GET() {
  const { streak, todayActive, repliesToday, replies7d, posts7d, ratio } = await computeActivity();
  return NextResponse.json({ streak, todayActive, repliesToday, replies7d, posts7d, ratio });
}
