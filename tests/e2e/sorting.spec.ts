import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Sorting is server-driven: the header writes the URL, TanStack Query refetches
 * and the server returns a reordered page.
 *
 * So these assertions read the values the table actually rendered and check the
 * ordering, rather than pinning a seeded name — a pinned name would pass just
 * as well against a table that never re-sorted at all. The first test also
 * asserts the *unsorted* order is not already alphabetical, because a check
 * that cannot fail proves nothing.
 */

const PASSKEY = "123456";

async function signIn(page: Page) {
  await page.goto("/?admin=true");
  await page.locator('input[autocomplete="one-time-code"]').fill(PASSKEY);
  await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
}

/**
 * The patient name is the first line of the Patient cell. Column order is
 * index, Patient, Status, … (components/table/columns.tsx), and every cell is
 * in the DOM at every width — the responsive ones are only `display: none`.
 */
async function patientNames(page: Page): Promise<string[]> {
  const cells = page.locator("tbody > tr > td:nth-child(2) p:first-child");
  await expect(cells.first()).toBeVisible();
  return (await cells.allTextContents()).map((text) => text.trim());
}

function isSortedAscending(values: string[]) {
  return values.every(
    (value, i) => i === 0 || values[i - 1]!.localeCompare(value) <= 0,
  );
}

/** Count before asserting: during hydration React briefly holds two copies. */
async function patientHeader(page: Page) {
  const header = page.getByRole("button", { name: "Patient" });
  await expect(header).toHaveCount(1);
  return header;
}

test.beforeEach(async ({ request }) => {
  const reset = await request.post("/api/test/reset");
  expect(reset.ok(), "demo store reset must succeed").toBe(true);
});

test("the patient header sorts the page and says so", async ({ page }) => {
  await signIn(page);

  const header = await patientHeader(page);

  expect(
    isSortedAscending(await patientNames(page)),
    "the seeded default must not already be alphabetical, or this proves nothing",
  ).toBe(false);

  await header.click();

  await expect(page).toHaveURL(/sort=patient/);
  await expect(page).toHaveURL(/direction=asc/);

  await expect
    .poll(async () => isSortedAscending(await patientNames(page)))
    .toBe(true);

  await expect(page.locator("th", { has: header })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
});

test("a third click returns the header to the default ordering", async ({
  page,
}) => {
  await signIn(page);

  const header = await patientHeader(page);
  const th = page.locator("th", { has: header });

  await expect(th).toHaveAttribute("aria-sort", "none");

  await header.click();
  await expect(th).toHaveAttribute("aria-sort", "ascending");

  await header.click();
  await expect(th).toHaveAttribute("aria-sort", "descending");
  // `desc` is the default direction and nuqs drops a param that equals its
  // default, so `?sort=patient` on its own *is* patient-descending. The
  // encoding is terser than the state, which is why aria-sort is asserted too.
  await expect(page).toHaveURL(/sort=patient/);
  await expect(page).not.toHaveURL(/direction=/);

  await header.click();
  await expect(th).toHaveAttribute("aria-sort", "none");
  // Now both are at their defaults, so the evidence of a reset is the absence
  // of the sort param as well.
  await expect(page).not.toHaveURL(/sort=/);
  await expect(page).not.toHaveURL(/direction=/);
});

test("sorting returns to the first page", async ({ page }) => {
  await signIn(page);

  await page.getByRole("button", { name: /next/i }).click();
  await expect(page).toHaveURL(/page=2/);

  await (await patientHeader(page)).click();

  await expect(page).not.toHaveURL(/page=2/);
  await expect(page.getByText(/Showing 1–/)).toBeVisible();
});

test("an unsortable column offers no control", async ({ page }) => {
  await signIn(page);

  // `status`, `primaryPhysician` and `reason` have no server-side ordering, so
  // their headers must stay inert text rather than look clickable and do
  // nothing. Scoped to the header row: "Reason" also appears in every card.
  const headerRow = page.locator("thead");
  await expect(headerRow.getByText("Status", { exact: true })).toBeVisible();
  await expect(
    headerRow.getByRole("button", { name: "Status" }),
  ).toHaveCount(0);
  await expect(headerRow.getByRole("button", { name: "Doctor" })).toHaveCount(0);
  await expect(headerRow.getByRole("button", { name: "Reason" })).toHaveCount(0);
});
