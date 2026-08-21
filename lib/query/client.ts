import { QueryClient, isServer } from "@tanstack/react-query";

import { AppError } from "@/lib/errors";

/**
 * QueryClient factory shared by the server and browser.
 *
 * `staleTime` must be non-zero for SSR: with the default of 0, every
 * server-rendered query is immediately stale and refetches the moment it
 * hydrates, throwing away the payload that was just streamed down.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Never retry a client error; the request will keep failing.
          if (error instanceof AppError) {
            if (
              error.code === "VALIDATION" ||
              error.code === "NOT_FOUND" ||
              error.code === "UNAUTHORIZED"
            ) {
              return false;
            }
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

/**
 * On the server, always a fresh client — a shared one would leak one request's
 * data into another's. In the browser, a singleton, so React does not discard
 * the cache on a suspense-driven re-render.
 */
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserClient ??= makeQueryClient();
  return browserClient;
}
