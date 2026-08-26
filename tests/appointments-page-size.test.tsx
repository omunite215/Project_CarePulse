// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";

import { DataTableSkeleton } from "@/components/states/Skeletons";
import { APPOINTMENTS_PAGE_SIZE } from "@/constants";
import { DemoRepository } from "@/lib/data/demo/demo.repository";
import { resetDemoStore } from "@/lib/data/demo/store";

/**
 * The page size used to be five copies of `10` and one stray `8`, which is how
 * the loading skeleton came to promise eight rows and the table then delivered
 * ten. These two assertions tie both ends of that mismatch to the same
 * constant, so the drift has nowhere left to happen.
 */

const SEED = 42;

beforeEach(() => {
  resetDemoStore(SEED);
});

it("renders one placeholder row per row the first page will hold", () => {
  const { container } = render(<DataTableSkeleton />);

  expect(container.querySelectorAll('[data-slot="skeleton-row"]')).toHaveLength(
    APPOINTMENTS_PAGE_SIZE,
  );
});

it("fills a default page to the same size the skeleton promises", async () => {
  // 17 seeded appointments, so page 1 is full and the length is the page size
  // rather than the fixture count.
  const { documents } = await new DemoRepository(SEED).listAppointments();

  expect(documents).toHaveLength(APPOINTMENTS_PAGE_SIZE);
});
