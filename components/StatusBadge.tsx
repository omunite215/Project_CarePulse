import Image from "next/image";

import { StatusIcon, StatusLabel } from "@/constants";
import type { AppointmentStatus } from "@/lib/data/types";
import { cn } from "@/lib/utils";

/**
 * Status pill.
 *
 * Colours come from per-status token pairs rather than the raw brand palette,
 * because the dark tints (#0d2a1f and friends) are unreadable on a light page.
 * Each pair is contrast-checked in both themes.
 */
const TONE: Record<AppointmentStatus, string> = {
  scheduled: "bg-status-scheduled-bg text-status-scheduled-fg",
  pending: "bg-status-pending-bg text-status-pending-fg",
  cancelled: "bg-status-cancelled-bg text-status-cancelled-fg",
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={cn("status-badge", TONE[status])}>
      <Image
        src={StatusIcon[status]}
        alt=""
        aria-hidden="true"
        width={24}
        height={24}
        className="size-3"
      />
      {/* Colour alone must not carry the meaning, so the label is always
          rendered rather than relying on the tone. */}
      <span className="text-12-semibold capitalize">{StatusLabel[status]}</span>
    </span>
  );
}
