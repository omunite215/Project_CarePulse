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
      ADMIN_PASSKEY: "123456",
      ADMIN_SESSION_SECRET: "playwright-only-session-secret-not-for-production",
      TZ: "America/New_York",
      // Unlocks /api/test/reset against the production build, so each test
      // starts from freshly seeded fixtures.
      E2E_TESTING: "true",
    },
  },
});
