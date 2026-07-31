import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Single shared-secret auth. When COCKPIT_TOKEN is unset (local dev), auth is OFF
// so localhost stays frictionless. When set (production), every page + API call
// must present the token — via the httpOnly cookie (browser, set by /api/login)
// or an `x-cockpit-token` / `Authorization: Bearer` header (extension + daemon).

const PUBLIC = new Set(["/login", "/api/login"]);

export function middleware(req: NextRequest) {
  const token = process.env.COCKPIT_TOKEN;
  if (!token) return NextResponse.next(); // auth disabled

  const { pathname } = req.nextUrl;
  if (PUBLIC.has(pathname)) return NextResponse.next();

  const cookie = req.cookies.get("cockpit_auth")?.value;
  const bearer = req.headers.get("authorization");
  const header = req.headers.get("x-cockpit-token");
  const ok = cookie === token || bearer === `Bearer ${token}` || header === token;
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

// Run on everything except Next internals and the favicon.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
