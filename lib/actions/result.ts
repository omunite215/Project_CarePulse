import type { z } from "zod";

import { AppError, type AppErrorCode, type FieldErrors, userMessage } from "@/lib/errors";

/**
 * The single shape every Server Action returns.
 *
 * A discriminated union rather than throwing, because a thrown error inside a
 * Server Action reaches the client as an opaque "An error occurred in the
 * Server Components render" in production — losing exactly the field-level
 * detail a form needs. `fieldErrors` is what lets the client map failures back
 * onto individual inputs via react-hook-form's `setError`.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { code: AppErrorCode; message: string; fieldErrors?: FieldErrors };
    };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(error: unknown): ActionResult<T> {
  const appError = AppError.from(error);

  // Server-side detail stays server-side; the client gets safe copy only.
  if (appError.code === "UNKNOWN" || appError.code === "UPSTREAM") {
    console.error("[action]", appError.message, appError.cause ?? "");
  }

  return {
    ok: false,
    error: {
      code: appError.code,
      message: userMessage(appError),
      fieldErrors: appError.fieldErrors,
    },
  };
}

/**
 * Wraps an action body so no throw escapes to the client.
 *
 * `next/navigation`'s `redirect()` and `notFound()` work by throwing a special
 * error, so those must be allowed through rather than swallowed.
 */
export async function run<T>(
  body: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return ok(await body());
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail<T>(error);
  }
}

/**
 * Re-validates input on the server.
 *
 * Client-side zodResolver validation is a UX affordance, not a guarantee — a
 * Server Action is a public HTTP endpoint and can be called directly.
 */
export function parseOrThrow<S extends z.ZodType>(
  schema: S,
  input: unknown,
): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }

  throw AppError.validation("Please check the highlighted fields.", fieldErrors);
}

function isNextControlFlow(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    /^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK)/.test(
      (error as { digest: string }).digest,
    )
  );
}
