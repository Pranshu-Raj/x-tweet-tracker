import { NextResponse } from "next/server";
import { all, get, run, nowIso } from "@/lib/db";
import type { Profile } from "@/lib/types";

export const runtime = "nodejs";

const str = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
};
const int = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

// GET /api/profile — the latest scraped profile snapshot (or null).
export async function GET() {
  const profile =
    (await get<Profile>("SELECT * FROM profile ORDER BY id DESC LIMIT 1")) ?? null;
  return NextResponse.json({ profile });
}

// POST /api/profile — store a scraped snapshot. Keeps only the latest.
export async function POST(req: Request) {
  const p = await req.json().catch(() => null);
  const handle = str(p?.handle);
  if (!handle) {
    return NextResponse.json({ error: "handle is required" }, { status: 400 });
  }

  await run("DELETE FROM profile");
  await run(
    `INSERT INTO profile
       (name, handle, bio, location, url, pinned_tweet, following, followers, captured_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      str(p?.name),
      handle.replace(/^@+/, ""),
      str(p?.bio),
      str(p?.location),
      str(p?.url),
      str(p?.pinnedTweet),
      int(p?.following),
      int(p?.followers),
      nowIso(),
    ]
  );

  const profile = (await all<Profile>("SELECT * FROM profile ORDER BY id DESC LIMIT 1"))[0];
  return NextResponse.json({ profile }, { status: 201 });
}
