import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth/session";

/**
 * Edge guard for the admin surface.
 *
 * Next 16 renamed `middleware.ts` to `proxy.ts`; this is that file.
 *
 * It runs on the edge runtime, so it cannot import `lib/env.ts` (which is
 * `server-only` and uses Node APIs) — the secret is read straight from
 * `process.env`, and `lib/auth/session.ts` is deliberately WebCrypto-only so it
 * is importable from here.
 *
 * This is defence in depth, not the only check: `requireAdmin()` re-verifies in
 * the page and the API routes verify per-request, because middleware protects
 * navigation rather than data.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const secret =
    process.env.ADMIN_SESSION_SECRET ??
    "carepulse-development-only-session-secret-change-me";

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  const authorised = await verifySessionToken(token, secret);

  if (authorised) return NextResponse.next();

  // API callers get a JSON 401; a redirect to an HTML page would be useless to
  // fetch().
  if (pathname.startsWith("/api/v1/appointments")) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Admin access required." } },
      { status: 401 },
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "?admin=true";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/v1/appointments/:path*"],
};
