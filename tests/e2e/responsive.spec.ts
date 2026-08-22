import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Horizontal overflow is a property, not a snapshot.
 *
 * The layout used to cap content at 860px inside a `px-[5%]` gutter, and the
 * admin table needed ~975px before its columns collided. Neither was visible
 * to HTTP-level testing, and screenshots only catch a regression if a human
 * looks at them. This asserts the invariant directly at every breakpoint the
 * design targets, so the next regression fails CI instead of shipping — and
 * it never needs regenerating when the design changes, because it is a bound
 * ("content fits the viewport"), not a pixel diff.
 */
const WIDTHS = [390, 640, 768, 1024, 1280, 1536, 1920] as const;

const PASSKEY = "123456";

/**
 * The phone field, unambiguously.
 *
 * Copied from `flows.spec.ts`: `getByLabel("Phone number")` matches two
 * elements because react-phone-number-input renders a country <select>
 * labelled "Phone number country" alongside the tel input. Targeting the
 * textbox role picks the input.
 */
function phoneInput(page: Page) {
  return page.getByRole("textbox", { name: "Phone number" });
}

async function expectNoOverflow(page: Page, label: string) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  // +1 absorbs sub-pixel rounding on fractional device widths (a
  // devicePixelRatio that does not divide evenly into the CSS width can round
  // scrollWidth up by a hair even with no real overflow). A genuine overflow
  // — a fixed-width element, an un-shrinkable flex child — shows up in whole
  // tens of pixels, so this tolerance is nowhere close to hiding one.
  expect(
    scrollWidth,
    `${label} overflows by ${scrollWidth - innerWidth}px`,
  ).toBeLessThanOrEqual(innerWidth + 1);
}

/**
 * Onboards a throwaway user through the real form and lands on their
 * registration page.
 *
 * `demo-user` — the fixture every other route below measures — already has a
 * patient record, so `/patients/demo-user/register` redirects straight to
 * `/new-appointment` before the registration form ever renders. Measuring
 * that redirect target would be a valid measurement, but labelling it
 * "register" would be a lie: it never touches the widest, most complex layout
 * in the app (23 fields across four responsive sections). That layout is
 * exactly what this suite exists to catch a regression in, so each width
 * buys a fresh user rather than taking the shortcut.
 *
 * Called from inside the "/" assertion below rather than after a second
 * `page.goto("/")`, so onboarding is only visited once per test.
 */
async function reachRegistrationForm(page: Page, width: number) {
  await page.getByLabel("Full name").fill("Overflow Check");
  // Keyed by width and time: this runs once per width in this file, and the
  // demo store is reset before every test, so a stable string would still be
  // safe — but a unique one costs nothing and rules out cross-test collision
  // entirely if the reset ever regresses.
  await page
    .getByLabel("Email")
    .fill(`overflow-${width}-${Date.now()}@example.com`);
  await phoneInput(page).fill("+12025551234");
  await page.getByRole("button", { name: /get started/i }).click();

  await expect(page).toHaveURL(/\/patients\/[^/]+\/register$/, {
    timeout: 15_000,
  });
  await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  // Reseed so every width starts from the same fixed fixtures — matches the
  // pattern in flows.spec.ts, asserted rather than fire-and-forget for the
  // same reason: a silent 404 here would leak state and the resulting
  // overflow (or lack of it) would point everywhere except this endpoint.
  const reset = await request.post("/api/test/reset");
  expect(reset.ok(), "demo store reset must succeed").toBe(true);
});

for (const width of WIDTHS) {
  test(`patient routes do not overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });

    // Onboarding.
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /hi there/i }),
    ).toBeVisible();
    await expectNoOverflow(page, `onboarding @ ${width}`);

    // Registration — the real form, reached honestly (see the comment on
    // reachRegistrationForm). Labelled distinctly from "register" so a
    // failure here is never confused with a measurement of the redirect.
    await reachRegistrationForm(page, width);
    await expectNoOverflow(page, `register (real form) @ ${width}`);

    // Booking.
    await page.goto("/patients/demo-user/new-appointment");
    await expect(
      page.getByRole("heading", { name: /new appointment/i }),
    ).toBeVisible();
    await expectNoOverflow(page, `new appointment @ ${width}`);

    // My appointments.
    await page.goto("/patients/demo-user/appointments");
    await expect(
      page.getByRole("heading", { name: /your appointments/i }),
    ).toBeVisible();
    await expectNoOverflow(page, `my appointments @ ${width}`);

    // Success.
    await page.goto(
      "/patients/demo-user/new-appointment/success?appointmentId=demo-appt-1",
    );
    await expect(
      page.getByRole("heading", { name: /appointment request/i }),
    ).toBeVisible();
    await expectNoOverflow(page, `success @ ${width}`);
  });
}

test.describe("admin", () => {
  test.beforeEach(async ({ page }) => {
    // Login is UI-driven, not a cookie fixture, because the passkey flow sets
    // an httpOnly session cookie that a test cannot forge — the "forged
    // cookie" case in flows.spec.ts is exactly this property working.
    await page.goto("/?admin=true");
    await page.locator('input[autocomplete="one-time-code"]').fill(PASSKEY);
    await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
  });

  for (const width of WIDTHS) {
    test(`dashboard does not overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin");

      // Not networkidle: the dashboard polls every 60s via TanStack Query's
      // refetchInterval, so "no network activity for 500ms" is a promise this
      // page never keeps and networkidle would wait out the full timeout.
      // "Search appointments" belongs to AppointmentFilters, which only
      // renders once the seeded query-client cache has resolved past the
      // `isPending` skeleton branch — a real, width-independent signal that
      // the data-dependent part of the layout (stat cards, filters, and the
      // table-or-card-list split at `md`) has actually painted, not just the
      // static server-rendered chrome around it.
      await expect(page.getByLabel("Search appointments")).toBeVisible();
      await expectNoOverflow(page, `admin @ ${width}`);
    });
  }
});
