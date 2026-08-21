import type { NextRequest } from "next/server";

import { getRepository } from "@/lib/data";
import { buildDaySlots } from "@/lib/services/availability";
import { AvailabilityQueryParams, parseSearchParams } from "@/lib/api/schemas";
import { jsonError, jsonOk } from "@/lib/api/respond";

/**
 * Slot availability for a doctor on a day.
 *
 * Not admin-gated: a patient booking an appointment needs it. It exposes only
 * which slots are taken, never who holds them.
 */
export async function GET(request: NextRequest) {
  try {
    const { physician, day } = parseSearchParams(
      AvailabilityQueryParams,
      request.nextUrl.searchParams,
    );

    const repo = await getRepository();
    const booked = await repo.getBookedSlots(physician, day);

    return jsonOk(buildDaySlots(new Date(day), booked), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
}
