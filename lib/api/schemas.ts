import { z } from "zod";

import { APPOINTMENT_STATUSES } from "@/lib/data/types";

/**
 * Wire contracts for `/api/v1`.
 *
 * Query strings are all strings, so this is where they become typed values —
 * and where a hostile `?pageSize=100000` gets clamped instead of turning into a
 * full table scan.
 */
export const AppointmentQueryParams = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum([...APPOINTMENT_STATUSES, "all"]).default("all"),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sort: z.enum(["schedule", "createdAt", "patient"]).default("createdAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});

export const AvailabilityQueryParams = z.object({
  physician: z.string().min(1),
  day: z.iso.datetime(),
});

/** Parses URLSearchParams, dropping empties so defaults apply. */
export function parseSearchParams<S extends z.ZodType>(
  schema: S,
  searchParams: URLSearchParams,
): z.output<S> {
  const raw: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (value !== "") raw[key] = value;
  }
  return schema.parse(raw);
}
