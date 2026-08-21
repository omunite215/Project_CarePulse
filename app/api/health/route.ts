import { getServerEnv } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/api/respond";

/**
 * Liveness probe.
 *
 * Reports which data source is live, which is the single most useful thing to
 * know when a deployment "works" but shows fixture data. Deliberately exposes
 * no counts, ids or configuration values.
 */
export async function GET() {
  try {
    const env = getServerEnv();

    return jsonOk(
      {
        status: "ok",
        dataSource: env.dataSource,
        demoMode: env.dataSource === "demo",
        environment: env.NODE_ENV,
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
