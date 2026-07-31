import { NextResponse } from "next/server";

export const runtime = "nodejs";

// POST /api/login — exchange the shared secret for an httpOnly session cookie.
export async function POST(req: Request) {
  const token = process.env.COCKPIT_TOKEN;
  if (!token) return NextResponse.json({ ok: true, note: "auth disabled" });

  const payload = await req.json().catch(() => null);
  const given = typeof payload?.token === "string" ? payload.token : "";
  if (given !== token) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("cockpit_auth", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90, // 90 days
  });
  return res;
}
