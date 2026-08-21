import { NextResponse } from "next/server";
import { z } from "zod";

import { AppError, userMessage } from "@/lib/errors";

/**
 * Uniform JSON envelope for route handlers.
 *
 * Errors go out in the same `{ error: { code, message } }` shape the Server
 * Actions use, so `lib/http/client.ts` has one thing to unwrap regardless of
 * which transport produced the failure.
 */
export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(error: unknown) {
  // A Zod failure here means a malformed query string, which is a 400 — not the
  // 500 an unhandled throw would produce.
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION",
          message: "Invalid request parameters.",
          issues: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      },
      { status: 400 },
    );
  }

  const appError = AppError.from(error);

  if (appError.status >= 500) {
    console.error("[api]", appError.code, appError.message);
  }

  return NextResponse.json(
    { error: { code: appError.code, message: userMessage(appError) } },
    { status: appError.status },
  );
}
