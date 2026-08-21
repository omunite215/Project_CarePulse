import "@testing-library/jest-dom/vitest";

/**
 * Tests run against the demo repository by default, with a fixed seed so
 * assertions on counts and ids stay stable.
 */
process.env.DEMO_MODE = "true";
process.env.DEMO_SEED = "42";
process.env.ADMIN_PASSKEY ??= "123456";
process.env.ADMIN_SESSION_SECRET ??=
  "test-only-session-secret-that-is-long-enough";
