import { queryOptions } from "@tanstack/react-query";

import type {
  AppointmentCounts,
  AppointmentListResult,
  AppointmentQuery,
  TimeSlot,
} from "@/lib/data/types";
import { getJson } from "@/lib/http/client";
import { appointmentKeys } from "./keys";

/**
 * Query option factories.
 *
 * Colocating the key with its fetcher means a component cannot accidentally
 * pair one query's key with another's request, and the same options object is
 * reusable for `useQuery`, `prefetchQuery` and `setQueryData` seeding.
 */

export function appointmentListOptions(query: AppointmentQuery) {
  return queryOptions({
    queryKey: appointmentKeys.list(query),
    queryFn: () =>
      getJson<AppointmentListResult>("/appointments", {
        search: query.search,
        status: query.status,
        from: query.from,
        to: query.to,
        page: query.page,
        pageSize: query.pageSize,
        sort: query.sort,
        direction: query.direction,
      }),
    // Keeps the previous page on screen while the next one loads, instead of
    // collapsing the table to a skeleton on every pagination click.
    placeholderData: (previous) => previous,
  });
}

export function appointmentStatsOptions() {
  return queryOptions({
    queryKey: appointmentKeys.stats(),
    queryFn: () => getJson<AppointmentCounts>("/appointments/stats"),
  });
}

export function availabilityOptions(physician: string, day: string) {
  return queryOptions({
    queryKey: appointmentKeys.availability(physician, day),
    queryFn: () =>
      getJson<TimeSlot[]>("/availability", { physician, day }),
    enabled: Boolean(physician && day),
    // Availability goes stale the moment somebody else books.
    staleTime: 10_000,
  });
}
