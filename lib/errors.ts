/**
 * One error type for the whole app.
 *
 * The original code had exactly one error handler — `catch (error) {
 * console.log(error) }` — so failures were invisible to the user and
 * indistinguishable from each other. Everything now normalises into an
 * `AppError` with a stable machine-readable code, which is what lets the UI
 * decide between "retry", "fix your input" and "this is broken".
 */

export type AppErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "UPSTREAM"
  | "NETWORK"
  | "UNKNOWN";

/** Per-field messages, keyed by form field name. */
export type FieldErrors = Record<string, string>;

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly fieldErrors?: FieldErrors;
  readonly status: number;

  constructor(
    code: AppErrorCode,
    message: string,
    options: { fieldErrors?: FieldErrors; cause?: unknown; status?: number } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = options.fieldErrors;
    this.status = options.status ?? STATUS_BY_CODE[code];
  }

  static notFound(what: string) {
    return new AppError("NOT_FOUND", `${what} could not be found.`);
  }

  static unauthorized(message = "You are not authorised to do that.") {
    return new AppError("UNAUTHORIZED", message);
  }

  static validation(message: string, fieldErrors?: FieldErrors) {
    return new AppError("VALIDATION", message, { fieldErrors });
  }

  /**
   * Normalises anything thrown — Appwrite SDK errors, xior errors, plain
   * strings — into an AppError. Appwrite signals "already exists" with HTTP
   * 409, which the onboarding flow treats as success.
   */
  static from(error: unknown): AppError {
    if (error instanceof AppError) return error;

    if (isObject(error)) {
      const status =
        pickNumber(error, "code") ??
        pickNumber(error, "status") ??
        pickNumber(error, "response.status");
      const message =
        pickString(error, "message") ?? "Something went wrong.";

      if (status === 409) {
        return new AppError("CONFLICT", message, { cause: error, status: 409 });
      }
      if (status === 404) {
        return new AppError("NOT_FOUND", message, { cause: error, status: 404 });
      }
      if (status === 401 || status === 403) {
        return new AppError("UNAUTHORIZED", message, {
          cause: error,
          status,
        });
      }
      if (status === 429) {
        return new AppError("RATE_LIMITED", message, {
          cause: error,
          status: 429,
        });
      }
      if (typeof status === "number" && status >= 500) {
        return new AppError("UPSTREAM", message, { cause: error, status });
      }

      // xior/fetch network failures carry no status at all.
      if (
        message.toLowerCase().includes("fetch failed") ||
        message.toLowerCase().includes("network")
      ) {
        return new AppError("NETWORK", "Network request failed.", {
          cause: error,
        });
      }

      return new AppError("UNKNOWN", message, { cause: error });
    }

    return new AppError(
      "UNKNOWN",
      typeof error === "string" ? error : "Something went wrong.",
      { cause: error },
    );
  }
}

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  VALIDATION: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  UPSTREAM: 502,
  NETWORK: 503,
  UNKNOWN: 500,
};

/** Copy safe to show a user. Never leaks a stack or an upstream detail. */
export function userMessage(error: AppError): string {
  switch (error.code) {
    case "VALIDATION":
      return error.message;
    case "NOT_FOUND":
      return error.message;
    case "CONFLICT":
      return error.message;
    case "UNAUTHORIZED":
      return "You are not authorised to do that.";
    case "RATE_LIMITED":
      return "Too many attempts. Please wait a moment and try again.";
    case "NETWORK":
      return "Could not reach the server. Check your connection and try again.";
    case "UPSTREAM":
      return "The service is temporarily unavailable. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/* ----------------------------- tiny helpers ----------------------------- */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickString(obj: Record<string, unknown>, key: string) {
  const value = obj[key];
  return typeof value === "string" ? value : undefined;
}

function pickNumber(obj: Record<string, unknown>, path: string) {
  const value = path
    .split(".")
    .reduce<unknown>(
      (acc, key) => (isObject(acc) ? acc[key] : undefined),
      obj,
    );
  return typeof value === "number" ? value : undefined;
}
