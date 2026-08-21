import { getDemoStore } from "@/lib/data/demo/store";
import { getServerEnv } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/api/respond";

/**
 * Serves identification documents uploaded in demo mode.
 *
 * In live mode Appwrite Storage hosts the file and hands back its own URL, so
 * this route has nothing to do and says so with a 404 rather than pretending.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const env = getServerEnv();
    if (env.dataSource !== "demo") {
      return jsonOk(
        { error: { code: "NOT_FOUND", message: "Not available." } },
        { status: 404 },
      );
    }

    const { id } = await params;
    const file = getDemoStore(env.DEMO_SEED).files.get(id);

    if (!file) {
      return jsonOk(
        { error: { code: "NOT_FOUND", message: "File not found." } },
        { status: 404 },
      );
    }

    return new Response(file.bytes, {
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        // `inline` would let an uploaded SVG or HTML file execute in the app's
        // origin. Forcing a download removes that class of problem entirely.
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.name)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
