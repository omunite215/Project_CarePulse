"use client";

import { DayFlag, DayPicker, SelectionState, UI } from "@daypicker/react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Calendar built directly on DayPicker's `classNames` API rather than importing
 * the package stylesheet.
 *
 * Two reasons: the CSS-load order between a node_modules stylesheet and
 * `globals.css` is not deterministic (so theme overrides could lose), and every
 * class here resolves through the project's own design tokens, which is what
 * makes the light theme work.
 *
 * react-datepicker — which the original `globals.css` carried ~50 lines of
 * overrides for — is gone. DayPicker is what shadcn standardised on and it
 * handles keyboard navigation properly.
 */
export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Hoisted out of `Calendar` rather than defined inline in the `components` prop:
 * a component created during render gets a fresh identity every pass, which
 * remounts the icon on each re-render.
 */
function CalendarChevron({
  orientation,
  ...rest
}: {
  orientation?: "left" | "right" | "up" | "down";
  className?: string;
}) {
  return orientation === "left" ? (
    <ChevronLeftIcon className="size-4" {...rest} />
  ) : (
    <ChevronRightIcon className="size-4" {...rest} />
  );
}

function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn("p-1", className)}
      classNames={{
        [UI.Months]: "relative flex flex-col gap-4",
        [UI.Month]: "flex w-full flex-col gap-3",
        [UI.MonthCaption]: "flex h-9 items-center justify-center",
        [UI.CaptionLabel]: "text-14-medium text-foreground",
        [UI.Nav]: "absolute inset-x-0 top-0 flex items-center justify-between",
        [UI.PreviousMonthButton]:
          "inline-flex size-8 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40",
        [UI.NextMonthButton]:
          "inline-flex size-8 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40",
        [UI.MonthGrid]: "w-full border-collapse",
        [UI.Weekdays]: "flex",
        [UI.Weekday]:
          "text-12-regular w-9 flex-1 pb-1 text-center font-normal text-muted-foreground",
        [UI.Week]: "mt-1 flex w-full",
        [UI.Day]: "flex-1 p-0 text-center",
        [UI.DayButton]:
          "text-14-regular inline-flex size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40",
        [SelectionState.selected]:
          "[&>button]:bg-green-500 [&>button]:font-medium [&>button]:text-white [&>button]:hover:bg-green-500",
        [DayFlag.today]:
          "[&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-green-500",
        [DayFlag.outside]: "[&>button]:text-muted-foreground [&>button]:opacity-60",
        [DayFlag.disabled]: "[&>button]:text-muted-foreground [&>button]:opacity-40",
        [DayFlag.hidden]: "invisible",
        ...classNames,
      }}
      components={{ Chevron: CalendarChevron }}
      {...props}
    />
  );
}

export { Calendar };
