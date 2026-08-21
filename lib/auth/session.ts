import { SignJWT, jwtVerify } from "jose";

export const ADMIN_COOKIE = "carepulse_admin";
const ISSUER = "carepulse";
const AUDIENCE = "carepulse-admin";

/** 8 hours — long enough for a shift, short enough to matter. */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

/**
 * Admin session tokens.
 *
 * Deliberately edge-safe: `jose` uses WebCrypto, so this module can be imported
 * by `proxy.ts` (Next 16's renamed middleware), which runs on the edge runtime
 * and has no access to `node:crypto` or `next/headers`.
 *
 * This replaces the reference implementation, which compared a
 * `NEXT_PUBLIC_ADMIN_PASSKEY` against `btoa(passkey)` in localStorage — a scheme
 * where the secret ships inside the JS bundle and the "auth" is bypassable by
 * typing one line into the console.
 */

function secretKey(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(secret: string): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey(secret));
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, secretKey(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });
    return payload.role === "admin";
  } catch {
    // Expired, tampered with, or signed by a different secret — all mean "no".
    return false;
  }
}
