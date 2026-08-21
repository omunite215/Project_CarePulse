import "server-only";

import { cookies } from "next/headers";

import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { ADMIN_COOKIE, verifySessionToken } from "./session";

/**
 * Server-side admin checks.
 *
 * `proxy.ts` already blocks unauthenticated navigation to `/admin`, but these
 * exist because middleware is a routing concern, not an authorisation one: an
 * API route or a Server Action can be called directly, so each entry point
 * verifies for itself.
 */

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  return verifySessionToken(token, getServerEnv().ADMIN_SESSION_SECRET);
}

/** For RSC. Throws, which the route's error boundary renders. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw AppError.unauthorized("Admin access required.");
  }
}
