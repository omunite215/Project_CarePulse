import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Breakpoint evidence.
 *
 * Separate from `screenshots.spec.ts` on purpose: that one produces the 21
 * README images at a single width and its output is committed, so its diff
 * must stay readable. This produces 42 audit captures (6 routes x 7 widths)
 * that are regenerated on demand and not committed — the point is a human
 * looking at every width, not a pixel-diff snapshot.
 */
const OUT = "public/screenshots/responsive";
const PASSKEY = "123456";
const FIXED_TIME = new Date("2026-08-20T14:00:00-04:00");

const WIDTHS = [390, 640, 768, 1024, 1280, 1536, 1920] as const;

/**
 * The phone field, unambiguously.
 *
 * Copied from `flows.spec.ts` / `tests/e2e/responsive.spec.ts`:
 * `getByLabel("Phone number")` matches two elements because
 * react-phone-number-input renders a country <select> labelled "Phone number
 * country" alongside the tel input. Targeting the textbox role picks the
 * input.
 */
function phoneInput(page: Page) {
  return page.getByRole("textbox", { name: "Phone number" });
}

async function stabilise(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
      * { caret-color: transparent !important; }
    `,
  });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  // Not networkidle: the admin dashboard polls every 60s via TanStack
  // Query's refetchInterval (see tests/e2e/responsive.spec.ts), so "no
  // network activity for 500ms" is a promise it doesn't reliably keep and
  // networkidle can hang out the full test timeout. Every call site below
  // already awaits a concrete, route-specific visible element before calling
  // stabilise(), which is the readiness signal networkidle would have stood
  // in for.
}

/**
 * Onboards a throwaway user through the real form and lands on their
 * registration page.
 *
 * `demo-user` already has a patient record, so
 * `/patients/demo-user/register` redirects straight to `/new-appointment`
 * before the registration form ever renders (see
 * tests/e2e/flows.spec.ts:93). A screenshot labelled "register" that
 * actually shows the booking page would be worse than useless — it would get
 * cited as proof of something it doesn't show. So each width buys a fresh
 * user and reaches the form honestly, the same fix Task 9 applied in
 * tests/e2e/responsive.spec.ts.
 */
async function reachRegistrationForm(page: Page, width: number) {
  await page.getByLabel("Full name").fill("Responsive Shots");
  // Unique per width+time: the demo store is reset before every test so a
  // fixed string would be safe too, but this costs nothing and rules out
  // cross-test collisions entirely if the reset ever regresses.
  await page
    .getByLabel("Email")
    .fill(`responsive-shots-${width}-${Date.now()}@example.com`);
  await phoneInput(page).fill("+12025551234");
  await page.getByRole("button", { name: /get started/i }).click();

  await expect(page).toHaveURL(/\/patients\/[^/]+\/register$/, {
    timeout: 15_000,
  });
  await expect(
    page.getByRole("heading", { name: /a few details before your visit/i }),
  ).toBeVisible();
}

const REGISTER_STEP_IDS = ["personal", "medical", "identification", "review"] as const;

/**
 * Each step's own section heading, used to confirm a capture landed on the
 * step its filename claims.
 *
 * Not the compact "Step N of 4" progress bar (`RegisterStepProgress`): that
 * widget is in the DOM now, but `md:hidden` keeps it out of the desktop-width
 * captures in `WIDTHS`, so it can't serve as a signal common to all of them.
 * Each step's heading is unique and present at every width, so it proves the
 * same thing everywhere — a capture under `register-medical-*.png` that
 * actually shows step 1 would fail here rather than shipping mislabelled.
 */
const REGISTER_STEP_HEADINGS: Record<(typeof REGISTER_STEP_IDS)[number], RegExp> = {
  personal: /personal information/i,
  medical: /medical information/i,
  identification: /identification and verification/i,
  review: /consent and privacy/i,
};

test.beforeEach(async ({ page, request }) => {
  const reset = await request.post("/api/test/reset");
  expect(reset.ok(), "demo store reset must succeed").toBe(true);
  await page.clock.setFixedTime(FIXED_TIME);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const width of WIDTHS) {
  test(`patient routes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });

    // Onboarding.
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /hi there/i }),
    ).toBeVisible();
    await stabilise(page);
    await page.screenshot({
      path: `${OUT}/onboarding-${width}.png`,
      fullPage: true,
    });

    // Registration — the real form, reached honestly via a fresh user (see
    // reachRegistrationForm). Continues from the onboarding page above
    // rather than a second goto("/"), so onboarding is only visited once.
    //
    // Captures all four steps rather than the landing step alone: gating now
    // shows one section per page load, so a single full-page capture used to
    // show the whole 22-field form and would now silently show a quarter of
    // it under the same filename.
    await reachRegistrationForm(page, width);
    const base = page.url().split("?")[0];
    for (const step of REGISTER_STEP_IDS) {
      await page.goto(`${base}?step=${step}`);
      await expect(
        page.getByRole("heading", { name: REGISTER_STEP_HEADINGS[step] }),
      ).toBeVisible();
      await stabilise(page);
      await page.screenshot({
        path: `${OUT}/register-${step}-${width}.png`,
        fullPage: true,
      });
    }

    // New appointment (booking), for the seeded demo-user.
    await page.goto("/patients/demo-user/new-appointment");
    await expect(
      page.getByRole("heading", { name: /new appointment/i }),
    ).toBeVisible();
    await stabilise(page);
    await page.screenshot({
      path: `${OUT}/new-appointment-${width}.png`,
      fullPage: true,
    });

    // My appointments.
    await page.goto("/patients/demo-user/appointments");
    await expect(
      page.getByRole("heading", { name: /your appointments/i }),
    ).toBeVisible();
    await stabilise(page);
    await page.screenshot({
      path: `${OUT}/my-appointments-${width}.png`,
      fullPage: true,
    });

    // Success.
    await page.goto(
      "/patients/demo-user/new-appointment/success?appointmentId=demo-appt-1",
    );
    await expect(
      page.getByRole("heading", { name: /appointment request/i }),
    ).toBeVisible();
    await stabilise(page);
    await page.screenshot({
      path: `${OUT}/success-${width}.png`,
      fullPage: true,
    });
  });

  test(`admin dashboard at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?admin=true");
    // Single hidden OTP input, not a visible textbox role — see
    // components/PasskeyModal.tsx / input-otp's implementation.
    await page.locator('input[autocomplete="one-time-code"]').fill(PASSKEY);
    await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });

    // "Search appointments" belongs to AppointmentFilters, which only
    // renders once the seeded query-client cache has resolved past the
    // isPending skeleton branch — a real, width-independent readiness signal
    // (copied from tests/e2e/responsive.spec.ts) that the data-dependent
    // part of the layout has actually painted.
    //
    // Counted first: the label matches two inputs briefly during hydration,
    // and `toBeVisible()` throws a strict mode violation on a two-element
    // locator instead of waiting. See tests/e2e/responsive.spec.ts.
    const search = page.getByLabel("Search appointments");
    await expect(search).toHaveCount(1);
    await expect(search).toBeVisible();
    await stabilise(page);
    await page.screenshot({
      path: `${OUT}/admin-${width}.png`,
      fullPage: true,
    });
  });
}
