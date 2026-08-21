import type { NextRequest } from "next/server";

import { requireAdmin } from "@/lib/auth/guards";
import { getRepository } from "@/lib/data";
import { AppointmentQueryParams, parseSearchParams } from "@/lib/api/schemas";
import { jsonError, jsonOk } from "@/lib/api/respond";

/**
 * GET-only read projection for the admin table.
 *
 * Mutations deliberately do not live here — those are Server Actions, so there
 * is exactly one write path. This endpoint exists so TanStack Query can own
 * polling, filtering, pagination and optimistic rollback on the client without
 * a second source of truth.
 *
 * `proxy.ts` already blocks unauthenticated requests, but this re-checks:
 * middleware guards navigation, not data, and a route handler is directly
 * reachable.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const query = parseSearchParams(
      AppointmentQueryParams,
      request.nextUrl.searchParams,
    );

    const repo = await getRepository();
    const result = await repo.listAppointments(query);

    return jsonOk(result, {
      headers: {
        // Appointment data is per-operator and changes constantly; a shared
        // cache would serve one clinic's list to another.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
