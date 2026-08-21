/**
 * Fixed-window rate limiter for passkey attempts.
 *
 * A six-digit passkey is a million guesses; without a limiter that is minutes of
 * scripted brute force against a public Server Action. Five attempts per ten
 * minutes makes it useless while never inconveniencing someone who fat-fingers
 * a digit.
 *
 * In-memory and per-process, which is honest about what it is: enough for a
 * single-instance deployment, and it should be swapped for Redis or Upstash
 * behind more than one instance. Pinned to `globalThis` so hot reloads and
 * separate route modules share one counter.
 */

const LIMIT_KEY = Symbol.for("carepulse.ratelimit");

interface Window {
  count: number;
  resetAt: number;
}

type GlobalWithLimiter = typeof globalThis & {
  [LIMIT_KEY]?: Map<string, Window>;
};

function store() {
  const g = globalThis as GlobalWithLimiter;
  g[LIMIT_KEY] ??= new Map();
  return g[LIMIT_KEY]!;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  limit = 5,
  windowMs = 10 * 60 * 1000,
): RateLimitResult {
  const map = store();
  const now = Date.now();
  const existing = map.get(key);

  if (!existing || existing.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}

/** Clears the counter on success, so one good login resets the budget. */
export function resetRateLimit(key: string) {
  store().delete(key);
}
