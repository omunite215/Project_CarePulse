import type { LucideIcon } from "lucide-react";
import { CalendarIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  Icon?: LucideIcon;
  /** A way out — clear filters, book an appointment. */
  action?: ReactNode;
}

/**
 * Shown when a query legitimately returns nothing.
 *
 * Distinguishing "no results" from "still loading" and from "it broke" is the
 * whole point: an empty table with no explanation reads as a bug.
 */
export function EmptyState({
  title,
  description,
  Icon = CalendarIcon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface">
        <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-16-semibold text-foreground">{title}</p>
        {description ? (
          <p className="text-14-regular max-w-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
