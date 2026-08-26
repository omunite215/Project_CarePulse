"use client";

import {
  parseAsInteger,
  parseAsIsoDate,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";

import { DEFAULT_SORT, type SortState } from "@/components/table/sorting";
import { APPOINTMENTS_PAGE_SIZE } from "@/constants";
import {
  APPOINTMENT_SORT_KEYS,
  APPOINTMENT_STATUSES,
  SORT_DIRECTIONS,
} from "@/lib/data/types";

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
      // `parseAsStringLiteral`, so a hand-edited `?sort=reason` falls back to
      // the default instead of reaching the API as a 400.
      sort: parseAsStringLiteral(APPOINTMENT_SORT_KEYS).withDefault(
        DEFAULT_SORT.sort,
      ),
      direction: parseAsStringLiteral(SORT_DIRECTIONS).withDefault(
        DEFAULT_SORT.direction,
      ),
    },
    // Filtering is a view change, not a navigation: pushing every keystroke
    // would bury the previous page under dozens of history entries.
    { history: "replace", shallow: true },
  );

  /**
   * Ordering is deliberately absent here, and from `clear()`.
   *
   * `isFiltered` drives both the "No appointments match those filters" empty
   * state and the Clear button, and sorting never changes *which* rows match —
   * only their order. Folding it in would make a button labelled "Clear
   * filters" reset something it does not name. The header's third click is
   * sorting's own reset.
   */
  const isFiltered =
    filters.q !== "" ||
    filters.status !== "all" ||
    filters.from !== null ||
    filters.to !== null;

  const sortState: SortState = {
    sort: filters.sort,
    direction: filters.direction,
  };

  return {
    filters,
    setFilters,
    isFiltered,
    sortState,

    /** Any filter change resets to page 1; page 7 of a new filter is nonsense. */
    update: (patch: Partial<typeof filters>) =>
      setFilters({ ...patch, page: 1 }),

    setPage: (page: number) => setFilters({ page }),

    /** Re-ordering reshuffles every page, so page 7 of the old order is stale. */
    setSort: (next: SortState) =>
      setFilters({ sort: next.sort, direction: next.direction, page: 1 }),

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
      sort: filters.sort,
      direction: filters.direction,
    }),
  };
}
