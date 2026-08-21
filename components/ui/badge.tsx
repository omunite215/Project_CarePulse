import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-12-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-green-600 text-green-500",
        pending: "border-transparent bg-blue-600 text-blue-500",
        cancelled: "border-transparent bg-red-600 text-red-500",
        outline: "border-border text-foreground/80",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
