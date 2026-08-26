import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

/**
 * Skeleton-to-content parity for the admin table.
 *
 * Runs against the slow server (see playwright.config.ts) because a skeleton
 * that renders for 0ms cannot be measured. The two widths are the two layouts
 * that genuinely differ — below `md` the table is not rendered at all and a
 * card list takes its place — not every breakpoint the design targets, which
 * `tests/e2e/responsive.spec.ts` already covers for a different property.
 *
 * What this catches and what it does not, stated plainly so a green run is not
 * over-read: the row *count* assertion catches a skeleton short of the page
 * size at both widths, and the row *height* assertion catches the 51px-per-row
 * mobile defect. The desktop per-row delta was 5px, which is inside the
 * tolerance by design — a missing Reason placeholder changes the desktop
 * branch's width only, and the patient cell's line count is that 5px. Both are
 * held by the structural mirror in Skeletons.tsx, not by this test.
 */

const PASSKEY = "123456";

/** Sub-pixel border and font-metric differences are not drift. 51px was. */
const TOLERANCE_PX = 8;

const LAYOUTS = [
  { width: 390, label: "card list", rows: ".data-table ul > li" },
  { width: 1280, label: "table", rows: ".data-table tbody > tr" },
] as const;

async function signIn(page: Page) {
  await page.goto("/?admin=true");
  await page.locator('input[autocomplete="one-time-code"]').fill(PASSKEY);
  await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
}

async function boxOf(
  locator: Locator,
  label: string,
): Promise<{ width: number; height: number }> {
  const box = await locator.boundingBox();
  expect(box, `${label} must be laid out to be measured`).not.toBeNull();
  return { width: box!.width, height: box!.height };
}

for (const layout of LAYOUTS) {
  test(`the loading skeleton matches the ${layout.label} at ${layout.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: layout.width, height: 900 });
    await signIn(page);

    // `commit`, not the default `load`. The dashboard's data arrives in the
    // same streamed HTML response as its loading fallback, so waiting for
    // `load` waits for precisely the thing this test needs to observe first.
    await page.goto("/admin", { waitUntil: "commit" });

    const skeletonRows = page.locator('[data-slot="skeleton-row"]');
    await expect(skeletonRows.first()).toBeVisible();

    const skeletonCount = await skeletonRows.count();
    const skeletonRow = await boxOf(skeletonRows.first(), "skeleton row");

    // Content has replaced the fallback.
    await expect(skeletonRows).toHaveCount(0);

    const realRows = page.locator(layout.rows);

    // Auto-retrying, and load-bearing for more than the assertion it makes.
    // During hydration React briefly holds two copies of the streamed subtree
    // in the DOM, so a bare `count()` here can read double; `toHaveCount`
    // polls until it settles, which is both the parity assertion and the wait
    // that makes the measurement below unambiguous.
    await expect(
      realRows,
      "the skeleton must render one row per row the first page holds",
    ).toHaveCount(skeletonCount);

    // A cancelled appointment renders "No actions" where every other row
    // renders two buttons, so its row is genuinely shorter in both layouts and
    // seeded page 1 holds a mix. The skeleton mirrors the actionable variant,
    // so that is what it gets compared against — averaging over the mix would
    // move the target whenever the seed changes.
    const actionableRows = page.locator(`${layout.rows}:has(button)`);
    expect(
      await actionableRows.count(),
      "no actionable row on page 1 to measure against",
    ).toBeGreaterThan(0);

    const realRow = await boxOf(actionableRows.first(), "table row");

    expect(
      Math.abs(realRow.height - skeletonRow.height),
      `row height drifted: skeleton ${skeletonRow.height}px vs real ${realRow.height}px`,
    ).toBeLessThanOrEqual(TOLERANCE_PX);

    // Width too, because a skeleton can be the right height and still be the
    // wrong shape. `admin-main` is `flex flex-col items-center`, so anything
    // in it without an explicit width shrink-to-fits — which silently sized
    // this skeleton to the sum of its own placeholder bars rather than to the
    // table it stands in for.
    expect(
      Math.abs(realRow.width - skeletonRow.width),
      `row width drifted: skeleton ${skeletonRow.width}px vs real ${realRow.width}px`,
    ).toBeLessThanOrEqual(TOLERANCE_PX);
  });
}
