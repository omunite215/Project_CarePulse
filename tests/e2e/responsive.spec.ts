import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Horizontal overflow is a property, not a snapshot.
 *
 * The layout used to cap content at 860px inside a `px-[5%]` gutter. That was
 * invisible to HTTP-level testing, and screenshots only catch a regression if
 * a human looks at them, so `expectNoOverflow` asserts the invariant directly
 * — `document.documentElement.scrollWidth` fits the viewport — at every
 * breakpoint the design targets, on every patient route and the admin
 * dashboard shell.
 *
 * That check cannot see a table outgrowing its own container, though:
 * `components/ui/table.tsx` wraps every table in a `<div class="overflow-x-
 * auto">`, so a table wider than its space scrolls inside that div — the
 * div's own box never grows, and the *document's* scrollWidth stays flat no
 * matter how wide the table gets. `expectTableFitsWrapper` closes that gap by
 * comparing the wrapper's own scrollWidth against its clientWidth directly,
 * which is the only way to catch the admin table's historical "~975px before
 * its columns collided" regression class.
 *
 * Together these never need regenerating when the design changes, because
 * both are bounds ("content fits its container"), not pixel diffs.
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
 * Checks the admin table's own wrapper, not the document.
 *
 * `expectNoOverflow` never sees this class of regression (see the file
 * docstring): the wrapper's `overflow-x-auto` absorbs an over-wide table by
 * scrolling internally, which keeps the page itself from overflowing even
 * while the table has genuinely outgrown its box. Comparing the wrapper's
 * `scrollWidth` to its own `clientWidth` catches that directly.
 *
 * Below `md` the table is `display: none` (a card list renders instead), so
 * `scrollWidth` and `clientWidth` are both 0 and the assertion is a no-op —
 * intentionally, since there is nothing to measure there.
 */
async function expectTableFitsWrapper(page: Page, label: string) {
  const table = page.locator("table.shad-table");
  if ((await table.count()) === 0) return;

  const { scrollWidth, clientWidth } = await table.evaluate((el) => {
    const wrapper = el.parentElement as HTMLElement;
    return { scrollWidth: wrapper.scrollWidth, clientWidth: wrapper.clientWidth };
  });

  // +1 for the same reason as expectNoOverflow above: sub-pixel rounding on
  // fractional device widths can round scrollWidth up by a hair with no real
  // overflow, and a genuine table overflow is nowhere close to 1px.
  expect(
    scrollWidth,
    `${label} table wrapper overflows by ${scrollWidth - clientWidth}px`,
  ).toBeLessThanOrEqual(clientWidth + 1);
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
 * in the app (22 fields across four responsive sections). That layout is
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
  await expect(
    page.getByRole("heading", { name: /a few details before your visit/i }),
  ).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  // Reseed so every width starts from the same fixed fixtures — matches the
  // pattern in flows.spec.ts, asserted rather than fire-and-forget for the
  // same reason: a silent 404 here would leak state and the resulting
  // overflow (or lack of it) would point everywhere except this endpoint.
  const reset = await request.post("/api/test/reset");
  expect(reset.ok(), "demo store reset must succeed").toBe(true);
});

const REGISTER_STEP_IDS = ["personal", "medical", "identification", "review"] as const;

/**
 * Each step's own section heading, used to prove the walk below actually
 * reached that step.
 *
 * Not the compact "Step N of 4" progress bar (`RegisterStepProgress`): that
 * widget exists in the DOM now, but it's CSS-hidden at `md` and up (`md:hidden`),
 * so asserting on it at the desktop widths in `WIDTHS` would fail for a
 * reason that has nothing to do with overflow. Each step's heading is unique
 * and present at every width regardless, and serves the same purpose — if
 * the `?step=` param were ignored, every iteration below would keep showing
 * "Personal information" and every heading after the first would fail to
 * appear.
 */
const REGISTER_STEP_HEADINGS: Record<(typeof REGISTER_STEP_IDS)[number], RegExp> = {
  personal: /personal information/i,
  medical: /medical information/i,
  identification: /identification and verification/i,
  review: /consent and privacy/i,
};

/**
 * Measures every step, not just the first.
 *
 * Before the wizard, one page load put all four sections in the DOM at once,
 * so a single measurement covered the whole form. Measuring only step 1 now
 * would keep passing while covering a quarter as much — which is worse than
 * failing, because nothing would announce the loss.
 */
async function walkRegistrationSteps(page: Page, width: number) {
  const base = page.url().split("?")[0];

  for (const step of REGISTER_STEP_IDS) {
    await page.goto(`${base}?step=${step}`);
    await expect(
      page.getByRole("heading", { name: REGISTER_STEP_HEADINGS[step] }),
    ).toBeVisible();
    await expectNoOverflow(page, `register step "${step}" @ ${width}`);
  }
}

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
    // Walks all four steps rather than checking the landing step alone —
    // see walkRegistrationSteps above.
    await reachRegistrationForm(page, width);
    await walkRegistrationSteps(page, width);

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
      //
      // Counted before it is asserted visible.
      //
      // React streams the suspended dashboard into an out-of-order placeholder
      // (`<div id="S:1">`) and an inline script then relocates it into the real
      // slot. For roughly 50ms both copies are in the DOM, so this label
      // matches two inputs — and `getByLabel` matches hidden elements, while
      // only `toBeVisible()` filters on visibility. `toBeVisible()` on a
      // two-element locator throws a strict mode violation immediately rather
      // than waiting, so the wait could not ride out the window it existed to
      // wait for. That is what failed this test in roughly 6% of runs, at
      // whichever widths happened to land inside it.
      //
      // `toHaveCount(1)` polls until the placeholder copy is gone, holding the
      // invariant that the dashboard has exactly one search box. `.first()` is
      // not a safe substitute: it takes whichever copy comes first in DOM
      // order, which is not guaranteed to be the visible one.
      const search = page.getByLabel("Search appointments");
      await expect(search).toHaveCount(1);
      await expect(search).toBeVisible();
      await expectNoOverflow(page, `admin @ ${width}`);
      await expectTableFitsWrapper(page, `admin @ ${width}`);
    });
  }
});
