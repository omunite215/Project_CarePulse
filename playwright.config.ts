import { defineConfig, devices } from "@playwright/test";

const PORT = 3300;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Two projects sharing one server:
 *   e2e   — behavioural assertions
 *   shots — deterministic screenshots for the README
 *
 * The server runs the production build so the screenshots show what a deploy
 * actually looks like, and runs in demo mode so neither project needs a backend.
 */
export default defineConfig({
  testDir: "./tests",
  outputDir: "./.playwright",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    // Pinned so dates render identically wherever this runs.
    timezoneId: "America/New_York",
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "e2e",
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "shots",
      testMatch: /screenshots\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        // 2× for crisp README images.
        deviceScaleFactor: 2,
      },
    },
    {
      name: "responsive",
      // Lives at the top level (tests/responsive-shots.spec.ts), not under
      // tests/e2e/, so the e2e project's /e2e\/.*\.spec\.ts/ match can't pick
      // it up; the name also doesn't contain "screenshots.spec.ts", so the
      // shots project's testMatch above doesn't claim it either.
      testMatch: /responsive-shots\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        // Viewport is set per-test; 1× keeps 42 captures to a sane disk size.
        deviceScaleFactor: 1,
      },
    },
  ],

  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      // Force fixtures with a fixed seed, whatever is in .env.local.
      DEMO_MODE: "true",
      DEMO_SEED: "42",
      // Pinned, not inherited. The default is 600ms, and a slow server would
      // let `pnpm shots` capture a half-drawn page into the committed README
      // images — where the only thing that would catch it is someone noticing.
      // The e2e and responsive projects share this server and want it fast too.
      DEMO_LATENCY_MS: "0",
      ADMIN_PASSKEY: "123456",
      ADMIN_SESSION_SECRET: "playwright-only-session-secret-not-for-production",
      TZ: "America/New_York",
      // Unlocks /api/test/reset against the production build, so each test
      // starts from freshly seeded fixtures.
      E2E_TESTING: "true",
    },
  },
});
