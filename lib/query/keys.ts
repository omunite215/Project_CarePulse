import { APPOINTMENTS_PAGE_SIZE } from "@/constants";
import type { AppointmentQuery } from "@/lib/data/types";

/**
 * Query keys in one place.
 *
 * Hierarchical so a mutation can invalidate a whole subtree —
 * `queryClient.invalidateQueries({ queryKey: appointmentKeys.all })` catches
 * every list, filter permutation and stats read in one call.
 */
export const appointmentKeys = {
  all: ["appointments"] as const,
  lists: () => [...appointmentKeys.all, "list"] as const,
  list: (query: AppointmentQuery) =>
    [...appointmentKeys.lists(), normalise(query)] as const,
  stats: () => [...appointmentKeys.all, "stats"] as const,
  detail: (id: string) => [...appointmentKeys.all, "detail", id] as const,
  availability: (physician: string, day: string) =>
    [...appointmentKeys.all, "availability", physician, day] as const,
  mine: (userId: string) => [...appointmentKeys.all, "mine", userId] as const,
};

/**
 * Stable key shape.
 *
 * Object key order affects the serialised query key, so `{status, page}` and
 * `{page, status}` would otherwise be two different cache entries for the same
 * request. Undefined values are dropped for the same reason.
 */
function normalise(query: AppointmentQuery) {
  return {
    search: query.search || undefined,
    status: query.status ?? "all",
    from: query.from || undefined,
    to: query.to || undefined,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? APPOINTMENTS_PAGE_SIZE,
    sort: query.sort ?? "createdAt",
    direction: query.direction ?? "desc",
  };
}
