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

/**
 * jsdom does not implement `ResizeObserver` at all — a gap in jsdom's own
 * browser coverage, not a real signal about application code. Radix's
 * `RadioGroupItem`/`Checkbox` primitives use it (via a shared bubble-input
 * sizing hook) to keep a hidden native input the same size as the visible
 * control, for form/autofill compatibility. Any test that mounts one throws
 * `ReferenceError: ResizeObserver is not defined` without this stub — global,
 * not per-test-file, because any future test mounting either component would
 * hit the same gap.
 */
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver;
}
