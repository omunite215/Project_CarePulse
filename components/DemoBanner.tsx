import { InfoIcon } from "lucide-react";

import { isDemoMode } from "@/lib/env";

/**
 * States plainly that this is a demo.
 *
 * A healthcare UI that says nothing about its status invites someone to type a
 * real medical history into it. Saying so is the cheapest safety feature in the
 * app, and it doubles as the explanation for why the data resets on restart.
 */
export function DemoBanner() {
  if (!isDemoMode()) return null;

  return (
    <div
      role="note"
      className="text-12-regular mb-6 flex items-start gap-2 rounded-lg border border-status-pending-fg/25 bg-status-pending-bg px-3 py-2 text-status-pending-fg"
    >
      <InfoIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>
        <strong className="font-semibold">Demo mode.</strong> Data is seeded,
        held in memory, and reset when the server restarts. Not HIPAA compliant —
        please don&apos;t enter real patient information.
      </span>
    </div>
  );
}
