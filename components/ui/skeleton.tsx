import type * as React from "react";

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // Decorative: hidden from the accessibility tree so screen readers hear
      // the surrounding aria-busy region instead of a pile of empty divs.
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-surface", className)}
      {...props}
    />
  );
}

export { Skeleton };
