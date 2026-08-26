import { describe, expect, it } from "vitest";

import {
  ariaSortFor,
  DEFAULT_SORT,
  decodeSort,
  encodeSort,
  nextSortState,
  SORT_OPTIONS,
} from "@/components/table/sorting";
import { AppointmentQueryParams } from "@/lib/api/schemas";
import { APPOINTMENT_SORT_KEYS } from "@/lib/data/types";

/**
 * The header cycle is a pure function so it can be pinned here rather than
 * through a browser. Every branch an operator can reach in three clicks.
 */
describe("nextSortState", () => {
  it("starts a column that is not active at ascending", () => {
    expect(nextSortState(DEFAULT_SORT, "patient")).toEqual({
      sort: "patient",
      direction: "asc",
    });
  });

  it("turns the active ascending column descending", () => {
    expect(
      nextSortState({ sort: "patient", direction: "asc" }, "patient"),
    ).toEqual({ sort: "patient", direction: "desc" });
  });

  it("returns to the default from the active descending column", () => {
    expect(
      nextSortState({ sort: "patient", direction: "desc" }, "patient"),
    ).toEqual(DEFAULT_SORT);
  });

  it("restarts at ascending when a different column is clicked", () => {
    expect(
      nextSortState({ sort: "patient", direction: "desc" }, "schedule"),
    ).toEqual({ sort: "schedule", direction: "asc" });
  });
});

describe("ariaSortFor", () => {
  it("reports none for a column that is not the active sort", () => {
    expect(ariaSortFor({ sort: "patient", direction: "asc" }, "schedule")).toBe(
      "none",
    );
  });

  it("maps the active column's direction to the ARIA token", () => {
    expect(ariaSortFor({ sort: "patient", direction: "asc" }, "patient")).toBe(
      "ascending",
    );
    expect(ariaSortFor({ sort: "patient", direction: "desc" }, "patient")).toBe(
      "descending",
    );
  });
});

describe("the mobile select's options", () => {
  it("round-trips every option through encode and decode", () => {
    for (const option of SORT_OPTIONS) {
      expect(encodeSort(option.state)).toBe(option.value);
      expect(decodeSort(option.value)).toEqual(option.state);
    }
  });

  it("offers every key in both directions, and no more", () => {
    expect(SORT_OPTIONS).toHaveLength(APPOINTMENT_SORT_KEYS.length * 2);
  });

  it("labels every option it offers", () => {
    for (const option of SORT_OPTIONS) {
      expect(option.label, `${option.value} has no label`).toBeTruthy();
    }
  });

  it("falls back to the default rather than throwing on a hand-edited value", () => {
    expect(decodeSort("nonsense:asc")).toEqual(DEFAULT_SORT);
  });
});

/**
 * The select and the header write straight into the query string the API
 * parses, so a key this module offers that `schemas.ts` rejects would be a 400
 * an operator reaches by clicking. This pins the two lists together without
 * either file importing the other.
 */
it("offers exactly the sort keys the read API accepts", () => {
  for (const key of APPOINTMENT_SORT_KEYS) {
    expect(() =>
      AppointmentQueryParams.parse({ sort: key, direction: "asc" }),
    ).not.toThrow();
  }

  expect(() => AppointmentQueryParams.parse({ sort: "reason" })).toThrow();
});
