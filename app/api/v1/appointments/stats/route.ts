import { requireAdmin } from "@/lib/auth/guards";
import { getRepository } from "@/lib/data";
import { jsonError, jsonOk } from "@/lib/api/respond";

/**
 * Counts across every appointment, independent of the table's filters.
 *
 * Separate from the list endpoint so the StatCards can refresh on their own
 * cadence, and so filtering the table never changes the headline numbers.
 */
export async function GET() {
  try {
    await requireAdmin();

    const repo = await getRepository();
    const { counts } = await repo.listAppointments({ pageSize: 1 });

    return jsonOk(counts, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
}
