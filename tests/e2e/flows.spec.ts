import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * End-to-end verification of the two flows the app exists for.
 *
 * These run in a real browser deliberately: several behaviours here are
 * invisible to a plain HTTP client. Next streams the layout shell before a
 * page's async work completes, so a mid-render `redirect()` arrives as a
 * meta-refresh rather than a 302 — `curl` sees a 200 and a placeholder body,
 * a browser follows it.
 */

const PASSKEY = "123456";

/**
 * The phone field, unambiguously.
 *
 * `getByLabel("Phone number")` matches two elements: react-phone-number-input
 * renders a country <select> labelled "Phone number country" alongside the tel
 * input. Targeting the textbox role picks the input.
 */
function phoneInput(page: Page) {
  return page.getByRole("textbox", { name: "Phone number" });
}

test.beforeEach(async ({ request }) => {
  // Reseed so counts and ids are identical on every run. Asserted rather than
  // fire-and-forget: when this endpoint silently 404s, state leaks between
  // tests and the failures that follow point everywhere except here.
  const reset = await request.post("/api/test/reset");
  expect(reset.ok(), "demo store reset must succeed").toBe(true);
});

test.describe("patient flow", () => {
  test("onboarding creates a user and moves to registration", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /hi there/i }),
    ).toBeVisible();

    await page.getByLabel("Full name").fill("Ada Lovelace");
    await page.getByLabel("Email").fill("ada@example.com");
    await phoneInput(page).fill("+12025551234");

    await page.getByRole("button", { name: /get started/i }).click();

    await expect(page).toHaveURL(/\/patients\/[^/]+\/register$/);
    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
  });

  test("onboarding shows a field error for a bad phone number", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByLabel("Full name").fill("Ada Lovelace");
    await page.getByLabel("Email").fill("ada@example.com");
    await phoneInput(page).fill("123");
    await page.getByRole("button", { name: /get started/i }).click();

    await expect(page.getByText(/invalid phone number/i)).toBeVisible();
    // Still on the same page: a failed submit must not navigate.
    await expect(page).toHaveURL("/");
  });

  test("re-entering the same email resumes rather than failing", async ({
    page,
  }) => {
    const email = `resume-${Date.now()}@example.com`;

    await page.goto("/");
    await page.getByLabel("Full name").fill("First Attempt");
    await page.getByLabel("Email").fill(email);
    await phoneInput(page).fill("+12025551235");
    await page.getByRole("button", { name: /get started/i }).click();
    await expect(page).toHaveURL(/\/register$/);
    const firstUrl = page.url();

    await page.goto("/");
    await page.getByLabel("Full name").fill("Second Attempt");
    await page.getByLabel("Email").fill(email);
    await phoneInput(page).fill("+12025551235");
    await page.getByRole("button", { name: /get started/i }).click();
    await expect(page).toHaveURL(/\/register$/);

    expect(page.url()).toBe(firstUrl);
  });

  test("a registered patient is redirected past registration", async ({
    page,
  }) => {
    // demo-user is seeded with a patient record, so /register should bounce.
    await page.goto("/patients/demo-user/register");
    await expect(page).toHaveURL(/\/new-appointment$/, { timeout: 15_000 });
  });

  test("booking an appointment reaches the success page", async ({ page }) => {
    await page.goto("/patients/demo-user/new-appointment");

    await expect(
      page.getByRole("heading", { name: /new appointment/i }),
    ).toBeVisible();

    // Doctor
    await page.getByLabel("Doctor").click();
    await page.getByRole("option", { name: /Dr\. Alyana Cruz/ }).click();

    // Date + time.
    //
    // DayPicker gives each day button a full accessible name ("Friday, August
    // 21st, 2026"), so matching on a bare day number finds nothing. Picking the
    // first *enabled* day is both locale-independent and exactly the intent:
    // `fromDate={new Date()}` has already disabled everything in the past.
    await page.getByLabel("Date and time").click();

    const grid = page.getByRole("grid");
    await expect(grid).toBeVisible();

    // The LAST enabled day, not the first. The first enabled day is today, and
    // if the suite runs after clinic hours every slot on today is legitimately
    // in the past — the picker then correctly says "No times left on this day".
    // A day near the end of the month is always wide open.
    await grid.locator("button:not([disabled])").last().click();

    const slot = page
      .getByRole("group", { name: "Available times" })
      .locator("button:not([disabled])");
    await expect(slot.first()).toBeVisible();
    await slot.first().click();

    await page.getByLabel(/reason for appointment/i).fill("Routine check-up");

    await page.getByRole("button", { name: /book appointment/i }).click();

    await expect(page).toHaveURL(/\/success\?appointmentId=/, {
      timeout: 20_000,
    });
    await expect(
      page.getByRole("heading", { name: /appointment request/i }),
    ).toBeVisible();
  });

  test("a patient can see their own appointments", async ({ page }) => {
    await page.goto("/patients/demo-user/appointments");

    await expect(
      page.getByRole("heading", { name: /your appointments/i }),
    ).toBeVisible();
    await expect(page.getByText(/^Upcoming \(\d+\)$/)).toBeVisible();
  });

  test("a new patient completes all four registration steps", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByLabel("Full name").fill("Ada Lovelace");
    await page.getByLabel("Email").fill(`ada-${Date.now()}@example.com`);
    await phoneInput(page).fill("+12025551234");
    await page.getByRole("button", { name: /get started/i }).click();
    await expect(page).toHaveURL(/\/register$/);

    // ---- Step 1: personal ----
    await page.getByLabel(/date of birth/i).click();
    // Dropdowns, not 430 chevron clicks. This assertion is the regression
    // guard for the picker fix.
    //
    // VERIFY THESE TWO ACCESSIBLE NAMES AGAINST THE REAL DOM before trusting
    // them — they come from DayPicker, not from our code, and the selects are
    // `opacity-0` overlays. `selectOption` operates on the underlying <select>,
    // so invisibility is not the problem; the accessible name might be.
    await page.getByRole("combobox", { name: /year/i }).selectOption("1991");
    await page.getByRole("combobox", { name: /month/i }).selectOption("3");
    // Not a bare "18": DayPicker gives every day button a full accessible
    // name ("Thursday, April 18th, 1991"), the same property the booking
    // test above already works around. "18" then matches zero buttons and
    // hangs instead of failing fast, so the ordinal form is what actually
    // finds the day.
    await page
      .getByRole("grid")
      .getByRole("button", { name: /\b18th\b/ })
      .click();

    await page.getByRole("radio", { name: "Female" }).click();
    await page.getByLabel("Address").fill("418 Maple Street, Springfield, IL");
    await page.getByLabel(/occupation/i).fill("Mathematician");
    await page.getByLabel("Emergency contact name").fill("Charles Babbage");
    await page
      .getByRole("textbox", { name: "Emergency contact number" })
      .fill("+12025559876");
    await page.getByRole("button", { name: /continue/i }).click();

    // ---- Step 2: medical ----
    await expect(
      page.getByRole("heading", { name: /medical information/i }),
    ).toBeVisible();
    await page.getByLabel(/primary care physician/i).click();
    await page.getByRole("option", { name: /john green/i }).click();
    await page.getByLabel("Insurance provider").fill("Blue Shield");
    await page.getByLabel("Insurance policy number").fill("POL-123456");
    await page.getByLabel(/allergies/i).fill("Penicillin");
    await page.getByRole("button", { name: /continue/i }).click();

    // ---- Step 3: identification — entirely optional ----
    await expect(
      page.getByRole("heading", { name: /identification/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /skip this step/i }).click();

    // ---- Step 4: review and consent ----
    // The heading is "Consent and privacy", NOT "Review and consent".
    // "Review and consent" is only the step's internal `title`, and the review
    // step is excluded from the summary that renders titles — so no element
    // carries that text. Three other spec files key off this same heading.
    await expect(
      page.getByRole("heading", { name: /consent and privacy/i }),
    ).toBeVisible();
    // The summary is load-bearing: prove it shows what was entered.
    await expect(page.getByText("Ada Lovelace")).toBeVisible();
    await expect(page.getByText("Penicillin")).toBeVisible();
    await expect(page.getByText(/didn't add an ID document/i)).toBeVisible();

    await page.getByLabel(/consent to receive treatment/i).check();
    await page.getByLabel(/use and disclosure/i).check();
    await page.getByLabel(/privacy policy/i).check();
    await page.getByRole("button", { name: /complete registration/i }).click();

    await expect(page).toHaveURL(/\/new-appointment$/, { timeout: 15_000 });
  });

  test("a step will not advance while a required answer is missing", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByLabel("Full name").fill("Incomplete Person");
    await page.getByLabel("Email").fill(`incomplete-${Date.now()}@example.com`);
    await phoneInput(page).fill("+12025551299");
    await page.getByRole("button", { name: /get started/i }).click();
    await expect(page).toHaveURL(/\/register$/);

    // Address, occupation, DOB and the rest are all still empty.
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.getByRole("alert").first()).toBeVisible();
    // Still on step 1: a blocked step must not advance.
    await expect(
      page.getByRole("heading", { name: /personal information/i }),
    ).toBeVisible();
  });

  test("browser back returns to the previous step, not out of the form", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByLabel("Full name").fill("Back Button");
    await page.getByLabel("Email").fill(`back-${Date.now()}@example.com`);
    await phoneInput(page).fill("+12025551288");
    await page.getByRole("button", { name: /get started/i }).click();
    // Wait for the redirect before reading page.url(): onboarding's
    // navigation is a server round trip, and reading the URL synchronously
    // after click() can still observe "/" — every other "Get started" click
    // in this file waits for /register the same way before touching page.url().
    await expect(page).toHaveURL(/\/register$/);

    await page.goto(`${page.url()}?step=medical`);
    await expect(
      page.getByRole("heading", { name: /medical information/i }),
    ).toBeVisible();

    await page.goBack();
    await expect(
      page.getByRole("heading", { name: /personal information/i }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });
});

test.describe("admin access", () => {
  test("/admin is unreachable without the passkey", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/\?admin=true$/);
    await expect(page.getByText(/admin access/i)).toBeVisible();
  });

  test("a forged cookie does not grant access", async ({ page, context }) => {
    await context.addCookies([
      {
        name: "carepulse_admin",
        value: "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYWRtaW4ifQ.forged",
        domain: "127.0.0.1",
        path: "/",
      },
    ]);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/\?admin=true$/);
  });

  test("a wrong passkey is rejected with a message", async ({ page }) => {
    await page.goto("/?admin=true");

    await page.locator('input[autocomplete="one-time-code"]').fill("000000");
    await expect(page.getByText(/incorrect passkey/i)).toBeVisible();
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test("the correct passkey opens the dashboard", async ({ page }) => {
    await page.goto("/?admin=true");

    await page.locator('input[autocomplete="one-time-code"]').fill(PASSKEY);

    await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: /welcome back/i }),
    ).toBeVisible();
  });
});

test.describe("admin dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?admin=true");
    await page.locator('input[autocomplete="one-time-code"]').fill(PASSKEY);
    await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
  });

  test("shows the seeded counts", async ({ page }) => {
    // The fixed seed is 8 scheduled / 6 pending / 3 cancelled.
    await expect(
      page.getByText("Scheduled appointments").locator(".."),
    ).toContainText("8");
    await expect(
      page.getByText("Pending appointments").locator(".."),
    ).toContainText("6");
    await expect(
      page.getByText("Cancelled appointments").locator(".."),
    ).toContainText("3");
  });

  test("first paint is served from the hydrated cache, with no API call", async ({
    page,
  }) => {
    const calls: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/appointments")) {
        calls.push(request.url());
      }
    });

    await page.reload();
    await expect(page.getByRole("table")).toBeVisible();
    // Give any stray effect-driven fetch a chance to fire.
    await page.waitForTimeout(1500);

    expect(calls).toEqual([]);
  });

  test("status filter narrows the table and survives a reload", async ({
    page,
  }) => {
    await page.getByLabel("Filter by status").click();
    await page.getByRole("option", { name: "Cancelled" }).click();

    await expect(page).toHaveURL(/status=cancelled/);
    await expect(page.getByRole("table")).toBeVisible();

    const badges = page.getByText("Cancelled", { exact: true });
    expect(await badges.count()).toBeGreaterThan(0);

    // URL state means the view is shareable and survives refresh.
    await page.reload();
    await expect(page).toHaveURL(/status=cancelled/);
  });

  test("a search with no matches shows an empty state, not a blank table", async ({
    page,
  }) => {
    await page
      .getByLabel("Search appointments")
      .fill("zzz-definitely-no-match");

    await expect(page.getByText(/no appointments match those filters/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /clear filters/i }),
    ).toBeVisible();
  });

  test("cancelling an appointment updates its status", async ({ page }) => {
    const firstCancel = page
      .getByRole("button", { name: /^Cancel/ })
      .first();
    await firstCancel.click();

    await expect(
      page.getByRole("heading", { name: /cancel appointment/i }),
    ).toBeVisible();

    await page
      .getByLabel(/reason for cancellation/i)
      .fill("Patient rescheduled by phone");
    await page
      .getByRole("button", { name: /^Cancel appointment$/ })
      .click();

    // Toast confirms, and the SMS outcome is reported honestly either way.
    await expect(page.getByText(/appointment cancelled/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("resilience", () => {
  test("an unknown user id renders not-found", async ({ page }) => {
    await page.goto("/patients/does-not-exist/appointments");

    // Asserting on content rather than status: once the layout shell has begun
    // streaming, Next can no longer set a 404 and renders the not-found
    // boundary into the already-committed 200 response.
    await expect(
      page.getByRole("heading", { name: /page not found/i }),
    ).toBeVisible();
  });

  test("health endpoint reports demo mode", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.demoMode).toBe(true);
  });

  test("the availability API marks booked slots unavailable", async ({
    request,
  }) => {
    const day = new Date();
    day.setDate(day.getDate() + 1);
    day.setHours(0, 0, 0, 0);

    const response = await request.get("/api/v1/availability", {
      params: { physician: "John Green", day: day.toISOString() },
    });
    expect(response.ok()).toBe(true);

    const slots = await response.json();
    expect(Array.isArray(slots)).toBe(true);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s: { label: string }) => Boolean(s.label))).toBe(true);
  });
});
