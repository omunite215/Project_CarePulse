"use client";

import {
  parseAsInteger,
  parseAsIsoDate,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";

import { APPOINTMENTS_PAGE_SIZE } from "@/constants";
import { APPOINTMENT_STATUSES } from "@/lib/data/types";

const STATUS_OPTIONS = [...APPOINTMENT_STATUSES, "all"] as const;

/**
 * Filter state lives in the URL, not in React state.
 *
 * That makes a filtered view shareable and bookmarkable, survives a refresh,
 * and makes the back button behave — none of which a `useState` gives you. It
 * also means the query key derives from the URL, so TanStack Query caches each
 * filter combination separately for free.
 */
export function useAppointmentFilters() {
  const [filters, setFilters] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      status: parseAsStringLiteral(STATUS_OPTIONS).withDefault("all"),
      from: parseAsIsoDate,
      to: parseAsIsoDate,
      page: parseAsInteger.withDefault(1),
    },
    // Filtering is a view change, not a navigation: pushing every keystroke
    // would bury the previous page under dozens of history entries.
    { history: "replace", shallow: true },
  );

  const isFiltered =
    filters.q !== "" ||
    filters.status !== "all" ||
    filters.from !== null ||
    filters.to !== null;

  return {
    filters,
    setFilters,
    isFiltered,

    /** Any filter change resets to page 1; page 7 of a new filter is nonsense. */
    update: (patch: Partial<typeof filters>) =>
      setFilters({ ...patch, page: 1 }),

    setPage: (page: number) => setFilters({ page }),

    clear: () =>
      setFilters({ q: "", status: "all", from: null, to: null, page: 1 }),

    /** The shape the API and query key expect. */
    toQuery: () => ({
      search: filters.q || undefined,
      status: filters.status,
      from: filters.from?.toISOString(),
      to: filters.to?.toISOString(),
      page: filters.page,
      pageSize: APPOINTMENTS_PAGE_SIZE,
    }),
  };
}
