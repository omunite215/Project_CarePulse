"use server";

import { timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { checkRateLimit, resetRateLimit } from "@/lib/auth/rate-limit";
import {
  ADMIN_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
} from "@/lib/auth/session";
import { PasskeySchema } from "@/lib/validation/admin";
import { type ActionResult, parseOrThrow, run } from "./result";

/**
 * Exchanges the admin passkey for a signed, httpOnly session cookie.
 *
 * The comparison happens here, on the server, against a non-`NEXT_PUBLIC`
 * variable — so unlike the reference implementation the secret never reaches the
 * browser and cannot be read out of the bundle.
 */
export async function verifyAdminPasskey(
  input: unknown,
): Promise<ActionResult<{ ok: true }>> {
  return run(async () => {
    const { passkey } = parseOrThrow(PasskeySchema, input);
    const env = getServerEnv();

    const limit = checkRateLimit(await clientKey());
    if (!limit.allowed) {
      throw new AppError(
        "RATE_LIMITED",
        `Too many attempts. Try again in ${Math.ceil(
          limit.retryAfterSeconds / 60,
        )} minute(s).`,
      );
    }

    if (!constantTimeEquals(passkey, env.ADMIN_PASSKEY)) {
      throw AppError.validation("That passkey is not correct.", {
        passkey: `Incorrect passkey. ${limit.remaining} attempt(s) left.`,
      });
    }

    const token = await createSessionToken(env.ADMIN_SESSION_SECRET);
    const store = await cookies();

    store.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });

    resetRateLimit(await clientKey());
    return { ok: true as const };
  });
}

export async function signOutAdmin(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/");
}

/**
 * Compares in constant time.
 *
 * `===` on strings short-circuits at the first differing character, which leaks
 * a timing signal about how much of the passkey was right. `timingSafeEqual`
 * needs equal-length buffers, so both sides are hashed to a fixed width first.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = Buffer.from(encoder.encode(a.padEnd(64, "\0")));
  const bufB = Buffer.from(encoder.encode(b.padEnd(64, "\0")));
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/** Best-effort client identity for the rate-limit bucket. */
async function clientKey(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headerList.get("x-real-ip");
  return `passkey:${ip ?? "unknown"}`;
}
