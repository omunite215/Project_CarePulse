import xior, { XiorError } from "xior";
import dedupePlugin from "xior/plugins/dedupe";
import errorRetryPlugin from "xior/plugins/error-retry";

import { AppError } from "@/lib/errors";

/**
 * Browser HTTP client for the read API under `/api/v1`.
 *
 * xior is a fetch-based axios-alike, which matters here for two reasons: it is
 * ~6 KB rather than axios's ~30 KB, and because it *is* fetch it inherits
 * Next's caching and instrumentation instead of bypassing them with
 * XMLHttpRequest.
 *
 * Mutations do not come through here — those are Server Actions. This client
 * exists for the reads that TanStack Query owns: the admin table's polling,
 * filtering and pagination.
 */
export const http = xior.create({
  baseURL: "/api/v1",
  timeout: 15_000,
  headers: { Accept: "application/json" },
});

// Retry transient failures only. A 4xx is the caller's problem and retrying it
// just doubles the load.
http.plugins.use(
  errorRetryPlugin({
    retryTimes: 2,
    retryInterval: (count) => count * 400,
    enableRetry: (_config, error) => {
      const status = error instanceof XiorError ? error.response?.status : undefined;
      if (status === undefined) return true; // network-level failure
      return status >= 500 || status === 429;
    },
  }),
);

// Collapses identical in-flight GETs — React 19 strict-mode double effects and
// two components asking for the same query key would otherwise duplicate work.
http.plugins.use(dedupePlugin());

/** Normalises a xior failure into the app's error type. */
export function toAppError(error: unknown): AppError {
  if (error instanceof XiorError) {
    const status = error.response?.status;
    const body = error.response?.data as { error?: { message?: string } } | undefined;
    const message = body?.error?.message ?? error.message;

    return AppError.from({ message, status: status ?? 0 });
  }
  return AppError.from(error);
}

/** GET returning parsed JSON, with errors already normalised. */
export async function getJson<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<T> {
  try {
    const response = await http.get<T>(url, { params });
    return response.data;
  } catch (error) {
    throw toAppError(error);
  }
}
