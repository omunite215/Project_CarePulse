import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * README screenshots.
 *
 * Run with `pnpm shots`. Writes fixed filenames into `public/screenshots/`,
 * overwriting in place so re-running never leaves orphans behind.
 *
 * Determinism is the whole game here — a screenshot set that changes on every
 * run produces a noisy diff and stops being worth regenerating:
 *
 *  1. Seeded fixtures (DEMO_SEED=42) → the StatCards always read 8 / 6 / 3.
 *  2. `page.clock` freezes time before navigation, so "today" in the calendar
 *     and the footer year never move.
 *  3. Reduced-motion emulation plus a belt-and-braces stylesheet kills every
 *     animation, including the StatCard count-up, which would otherwise be
 *     caught mid-tick.
 *  4. Fonts are awaited and the pointer is parked away from any element so no
 *     stray hover or focus ring sneaks in. Scroll position is left alone
 *     because there is nothing to reset it from: every capture below reaches
 *     its state through a fresh `page.goto`/`page.reload` — including the
 *     register steps, which navigate via the `?step=` query param rather than
 *     scrolling to a section — and navigation already lands at the top.
 */

const OUT = "public/screenshots";
const PASSKEY = "123456";

/** Frozen instant. Inside clinic hours so slot grids show live availability. */
const FIXED_TIME = new Date("2026-08-20T14:00:00-04:00");

const DESKTOP = { width: 1440, height: 900 } as const;
const MOBILE = { width: 390, height: 844 } as const;

async function stabilise(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
      /* A blinking caret lands in about half of all captures. */
      * { caret-color: transparent !important; }
    `,
  });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.waitForLoadState("networkidle");
}

async function shot(page: Page, name: string) {
  await stabilise(page);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function setTheme(page: Page, theme: "light" | "dark") {
  // Both are needed: next-themes reads localStorage, and `enableSystem` means
  // the media query still decides the first paint.
  await page.addInitScript((value) => {
    window.localStorage.setItem("theme", value);
  }, theme);
  await page.emulateMedia({
    colorScheme: theme,
    reducedMotion: "reduce",
  });
}

async function signInAsAdmin(page: Page) {
  await page.goto("/?admin=true");
  await page.locator('input[autocomplete="one-time-code"]').fill(PASSKEY);
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });

  // Not the table: it's `hidden` below `md` (a card list renders instead — see
  // components/table/DataTable.tsx), so it can never become visible at the
  // 390px viewport the mobile captures use. The search input belongs to
  // AppointmentFilters, which mounts only once the seeded query-client cache
  // resolves past the `isPending` skeleton branch, so it is both present at
  // every width and a true signal that the data-dependent part of the
  // dashboard has actually painted — the same reason this assertion exists at
  // all, just satisfiable everywhere instead of only at desktop widths.
  await expect(page.getByLabel("Search appointments")).toBeVisible();
}

test.beforeEach(async ({ page, request }) => {
  const reset = await request.post("/api/test/reset");
  expect(reset.ok(), "demo store reset must succeed").toBe(true);

  await page.clock.setFixedTime(FIXED_TIME);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test.describe("patient screens", () => {
  test("01 + 02 onboarding, dark and light", async ({ page }) => {
    await setTheme(page, "dark");
    await page.setViewportSize(DESKTOP);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /hi there/i })).toBeVisible();
    await shot(page, "01-onboarding-dark");

    await setTheme(page, "light");
    await page.reload();
    await expect(page.getByRole("heading", { name: /hi there/i })).toBeVisible();
    await shot(page, "02-onboarding-light");
  });

  test("03 + 04 registration form", async ({ page }) => {
    await setTheme(page, "dark");
    await page.setViewportSize(DESKTOP);

    // demo-user is already registered, so use a fresh one to reach the form.
    await page.goto("/");
    await page.getByLabel("Full name").fill("Ada Lovelace");
    await page.getByLabel("Email").fill("ada.lovelace@example.com");
    await page
      .getByRole("textbox", { name: "Phone number" })
      .fill("+12025551234");
    await page.getByRole("button", { name: /get started/i }).click();
    await expect(page).toHaveURL(/\/register$/);

    await expect(
      page.getByRole("heading", { name: /personal information/i }),
    ).toBeVisible();
    await shot(page, "03-register-personal");

    // Gating now renders one step per page load, so the medical and consent
    // sections are no longer mounted alongside step 1 — scrollIntoViewIfNeeded
    // has nothing to scroll to and would hang. Navigate to each step directly
    // instead; the `?step=` query param is the wizard's own URL state (see
    // RegisterWizardProvider), not a scroll position.
    const base = page.url().split("?")[0];

    await page.goto(`${base}?step=medical`);
    await expect(
      page.getByRole("heading", { name: /medical information/i }),
    ).toBeVisible();
    await shot(page, "04-register-medical");

    // Titled "Consent and privacy", not "Review and consent": that's only
    // the step's internal `title` (used by the step indicator and, since a
    // later task, `RegisterReview`'s own summary above this heading) — no
    // element on screen carries the step's `title` text directly.
    await page.goto(`${base}?step=review`);
    await expect(
      page.getByRole("heading", { name: /consent and privacy/i }),
    ).toBeVisible();
    await shot(page, "05-register-consent");
  });

  test("06 + 07 booking with doctor select and time slots", async ({ page }) => {
    await setTheme(page, "dark");
    await page.setViewportSize(DESKTOP);
    await page.goto("/patients/demo-user/new-appointment");
    await expect(
      page.getByRole("heading", { name: /new appointment/i }),
    ).toBeVisible();
    await shot(page, "06-new-appointment");

    await page.getByLabel("Doctor").click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await shot(page, "07-doctor-select");
    await page.getByRole("option", { name: /Dr\. Alyana Cruz/ }).click();

    await page.getByLabel("Date and time").click();
    const grid = page.getByRole("grid");
    await expect(grid).toBeVisible();
    await grid.locator("button:not([disabled])").last().click();
    await expect(
      page.getByRole("group", { name: "Available times" }),
    ).toBeVisible();
    await shot(page, "08-time-slots");
  });

  test("09 success page", async ({ page, request }) => {
    await setTheme(page, "dark");
    await page.setViewportSize(DESKTOP);

    // Any seeded appointment id gives a stable, populated success page.
    const list = await request.get("/api/v1/availability", {
      params: { physician: "John Green", day: FIXED_TIME.toISOString() },
    });
    expect(list.ok()).toBe(true);

    await page.goto(
      "/patients/demo-user/new-appointment/success?appointmentId=demo-appt-1",
    );
    await expect(
      page.getByRole("heading", { name: /appointment request/i }),
    ).toBeVisible();
    await shot(page, "09-success");
  });

  test("10 my appointments", async ({ page }) => {
    await setTheme(page, "dark");
    await page.setViewportSize(DESKTOP);
    await page.goto("/patients/demo-user/appointments");
    await expect(
      page.getByRole("heading", { name: /your appointments/i }),
    ).toBeVisible();
    await shot(page, "10-my-appointments");
  });
});

test.describe("admin screens", () => {
  test("11 passkey modal", async ({ page }) => {
    await setTheme(page, "dark");
    await page.setViewportSize(DESKTOP);
    await page.goto("/?admin=true");

    // Three of six digits typed reads as "in use" rather than "empty".
    await page.locator('input[autocomplete="one-time-code"]').fill("123");
    await shot(page, "11-admin-passkey");
  });

  test("12 + 13 dashboard, dark and light", async ({ page }) => {
    await setTheme(page, "dark");
    await page.setViewportSize(DESKTOP);
    await signInAsAdmin(page);
    await shot(page, "12-admin-dashboard-dark");

    await setTheme(page, "light");
    await page.reload();
    await expect(page.getByRole("table")).toBeVisible();
    await shot(page, "13-admin-dashboard-light");
  });

  test("14 + 15 schedule and cancel dialogs", async ({ page }) => {
    await setTheme(page, "dark");
    await page.setViewportSize(DESKTOP);
    await signInAsAdmin(page);

    await page.getByRole("button", { name: /^Schedule/ }).first().click();
    await expect(
      page.getByRole("heading", { name: /schedule appointment/i }),
    ).toBeVisible();
    await shot(page, "14-admin-schedule-modal");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /^Cancel/ }).first().click();
    await expect(
      page.getByRole("heading", { name: /cancel appointment/i }),
    ).toBeVisible();
    await shot(page, "15-admin-cancel-modal");
    await page.keyboard.press("Escape");
  });

  test("16 + 17 filters and empty state", async ({ page }) => {
    await setTheme(page, "dark");
    await page.setViewportSize(DESKTOP);
    await signInAsAdmin(page);

    await page.getByLabel("Filter by status").click();
    await page.getByRole("option", { name: "Pending" }).click();
    await expect(page).toHaveURL(/status=pending/);
    await expect(page.getByRole("table")).toBeVisible();
    await shot(page, "16-admin-filtered");

    await page.getByLabel("Search appointments").fill("zzz-no-match");
    await expect(
      page.getByText(/no appointments match those filters/i),
    ).toBeVisible();
    await shot(page, "17-admin-empty-state");
  });
});

test.describe("states and responsive", () => {
  test("18 error state", async ({ page }) => {
    await setTheme(page, "dark");
    await page.setViewportSize(DESKTOP);

    // An unknown id renders the not-found boundary — a real, reachable state.
    await page.goto("/patients/does-not-exist/appointments");
    await expect(
      page.getByRole("heading", { name: /page not found/i }),
    ).toBeVisible();
    await shot(page, "18-not-found");
  });

  test("19 + 20 mobile", async ({ page }) => {
    await setTheme(page, "dark");
    await page.setViewportSize(MOBILE);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: /hi there/i })).toBeVisible();
    await shot(page, "19-mobile-onboarding");

    await signInAsAdmin(page);
    await shot(page, "20-mobile-admin");
  });
});
