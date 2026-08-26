// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { expect, it, vi } from "vitest";

import { useAppointmentFilters } from "@/components/admin/useAppointmentFilters";
import { DEFAULT_SORT } from "@/components/table/sorting";

/**
 * `toQuery()` was the one broken link in the sort chain.
 *
 * Every other layer already carried `sort` and `direction` — the schema, both
 * repositories, the query key and the fetcher — and this hook emitted neither,
 * so the API answered a default-sorted request no matter what the URL said.
 * These assertions run the real hook against nuqs' testing adapter rather than
 * inspecting the query key, because the key was never the part that was wrong.
 */

function filtersAt(searchParams: string, onUrlUpdate?: () => void) {
  return renderHook(() => useAppointmentFilters(), {
    wrapper: withNuqsTestingAdapter({ searchParams, onUrlUpdate, hasMemory: true }),
  });
}

it("emits the URL's ordering into the query the API receives", () => {
  const { result } = filtersAt("?sort=patient&direction=asc");

  expect(result.current.toQuery()).toMatchObject({
    sort: "patient",
    direction: "asc",
  });
});

it("falls back to the API's own default when the URL says nothing", () => {
  const { result } = filtersAt("");

  expect(result.current.toQuery()).toMatchObject({
    sort: DEFAULT_SORT.sort,
    direction: DEFAULT_SORT.direction,
  });
});

it("ignores an ordering the API would reject", () => {
  const { result } = filtersAt("?sort=reason&direction=sideways");

  expect(result.current.toQuery()).toMatchObject({
    sort: DEFAULT_SORT.sort,
    direction: DEFAULT_SORT.direction,
  });
});

it("returns to the first page when the ordering changes", async () => {
  const onUrlUpdate = vi.fn();
  const { result } = filtersAt("?page=3", onUrlUpdate);

  // nuqs queues URL writes and flushes them off a scheduler, so the promise
  // the setter returns is the only reliable signal that the write landed.
  await act(async () => {
    await result.current.setSort({ sort: "patient", direction: "asc" });
  });

  const event = onUrlUpdate.mock.calls.at(-1)?.[0] as
    | { searchParams: URLSearchParams }
    | undefined;
  expect(event, "setSort must write the URL").toBeDefined();

  expect(event!.searchParams.get("sort")).toBe("patient");
  // nuqs clears a param that equals its default, so page 1 is an absent `page`.
  expect(event!.searchParams.get("page") ?? "1").toBe("1");
});

/**
 * Pins a deliberate decision rather than an implementation detail: ordering
 * never changes *which* rows match, while `isFiltered` drives both the "No
 * appointments match those filters" empty state and the Clear button. A sorted
 * table that claimed to be filtered would offer to clear something it does not
 * name.
 */
it("does not count an ordering as a filter", () => {
  const { result } = filtersAt("?sort=patient&direction=asc");

  expect(result.current.isFiltered).toBe(false);
});
