import type { AppointmentSortKey, SortDirection } from "@/lib/data/types";
import { APPOINTMENT_SORT_KEYS } from "@/lib/data/types";

/**
 * Sort state, and the rules for moving between its values.
 *
 * A plain module rather than part of `useAppointmentFilters`: the cycle is the
 * only genuinely interesting logic here, and keeping it clear of nuqs means it
 * is pinned by unit tests instead of a browser. `DataTable` renders both sort
 * surfaces from these same values, so the header and the mobile select cannot
 * disagree about what "newest booked" means.
 */

export interface SortState {
  sort: AppointmentSortKey;
  direction: SortDirection;
}

/** Newest booking first — what `/api/v1/appointments` already defaults to. */
export const DEFAULT_SORT: SortState = { sort: "createdAt", direction: "desc" };

/**
 * The header cycle: ascending, descending, then back to the default.
 *
 * The third click is load-bearing because `createdAt` has no column of its own.
 * Without it the default ordering would be a trapdoor — one click to leave,
 * and unreachable at `md` and up. The default key is never itself a header, so
 * this never has to handle "reset to the column you are already on".
 */
export function nextSortState(
  current: SortState,
  key: AppointmentSortKey,
): SortState {
  if (current.sort !== key) return { sort: key, direction: "asc" };
  if (current.direction === "asc") return { sort: key, direction: "desc" };
  return DEFAULT_SORT;
}

/**
 * State for the `th`, not for the button inside it. `aria-sort` is a header
 * property, which is also why a column def cannot own it — a column renders
 * inside the cell, never as it.
 */
export function ariaSortFor(
  current: SortState,
  key: AppointmentSortKey,
): "ascending" | "descending" | "none" {
  if (current.sort !== key) return "none";
  return current.direction === "asc" ? "ascending" : "descending";
}

export function encodeSort(state: SortState): string {
  return `${state.sort}:${state.direction}`;
}

/**
 * Below `md` there is no header row to click, so the same three keys are
 * offered flat — one tap on a phone rather than a select plus a separate
 * direction toggle. The labels say what the ordering *is*: "Appointment
 * ascending" tells an operator nothing about which end they get.
 */
const OPTION_LABELS: Record<string, string> = {
  "createdAt:desc": "Newest booked",
  "createdAt:asc": "Oldest booked",
  "schedule:desc": "Appointment latest",
  "schedule:asc": "Appointment soonest",
  "patient:desc": "Patient Z–A",
  "patient:asc": "Patient A–Z",
};

export const SORT_OPTIONS: readonly {
  value: string;
  label: string;
  state: SortState;
}[] = APPOINTMENT_SORT_KEYS.flatMap((sort) =>
  // `desc` first per key, so the default is the first option in the list.
  (["desc", "asc"] as const).map((direction) => {
    const state: SortState = { sort, direction };
    const value = encodeSort(state);
    return { value, label: OPTION_LABELS[value] ?? value, state };
  }),
);

/**
 * Tolerant by design. The value always originates from `SORT_OPTIONS`, but a
 * hand-edited URL should land on the default rather than throw inside a render.
 */
export function decodeSort(value: string): SortState {
  return (
    SORT_OPTIONS.find((option) => option.value === value)?.state ?? DEFAULT_SORT
  );
}
