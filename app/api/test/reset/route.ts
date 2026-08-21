import { resetDemoStore } from "@/lib/data/demo/store";
import { getServerEnv } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/api/respond";

/**
 * Reseeds the demo store.
 *
 * Used by the Playwright suites so each run starts from a known state — which is
 * what makes the screenshots reproducible and the assertions on counts
 * meaningful.
 *
 * Two independent guards, and the ordering of them matters:
 *
 *  - `dataSource !== "demo"` is the one that prevents harm. Pointed at a real
 *    Appwrite project this would be a data-loss button; in demo mode there is
 *    nothing to lose but regenerated fixtures.
 *  - In production it additionally requires `E2E_TESTING=true`, so a deployed
 *    instance does not expose it by default.
 *
 * Gating on NODE_ENV *alone* was wrong: Playwright drives the production build,
 * so the reset silently 404'd and state leaked between tests.
 */
export async function POST() {
  try {
    const env = getServerEnv();

    const isDemo = env.dataSource === "demo";
    const allowedInProd = process.env.E2E_TESTING === "true";

    if (!isDemo || (env.NODE_ENV === "production" && !allowedInProd)) {
      return jsonOk(
        { error: { code: "NOT_FOUND", message: "Not available." } },
        { status: 404 },
      );
    }

    resetDemoStore(env.DEMO_SEED);
    return jsonOk({ reset: true, seed: env.DEMO_SEED });
  } catch (error) {
    return jsonError(error);
  }
}
