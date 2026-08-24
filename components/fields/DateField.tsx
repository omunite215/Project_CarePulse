"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { FormControl } from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getAvailability } from "@/lib/actions/appointment.actions";
import type { TimeSlot } from "@/lib/data/types";
import { cn, formatDateTime } from "@/lib/utils";

interface DateFieldProps {
  value?: Date | string;
  onChange: (value: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  /** Adds the time-slot grid below the calendar. */
  showTimeSelect?: boolean;
  /** Whose diary to check for taken slots. */
  physician?: string;
  fromDate?: Date;
  toDate?: Date;
  /**
   * `birthdate` swaps the month chevrons for month and year dropdowns. The
   * appointment picker keeps the default: a year dropdown spanning a booking
   * window of a few weeks would be absurd.
   */
  variant?: "default" | "birthdate";
}

/**
 * Date, and optionally time, picker.
 *
 * When `showTimeSelect` is on, the slot grid is loaded from the server for the
 * selected doctor and day, and already-booked slots are disabled. The Server
 * Action re-checks the choice on submit — disabling here is a courtesy, not a
 * guarantee, because two people can pick the same slot before either submits.
 */
export function DateField({
  value,
  onChange,
  placeholder,
  disabled,
  required,
  showTimeSelect,
  physician,
  fromDate,
  toDate,
  variant,
}: DateFieldProps) {
  const selected = parseDate(value);
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<TimeSlot[] | null>(null);
  const [isLoadingSlots, startLoading] = useTransition();

  const dayKey = selected ? selected.toDateString() : "";

  useEffect(() => {
    if (!showTimeSelect || !selected || !physician) {
      setSlots(null);
      return;
    }

    let cancelled = false;
    startLoading(async () => {
      const result = await getAvailability({
        physician,
        day: selected.toISOString(),
      });
      if (cancelled) return;
      setSlots(result.ok ? result.data : []);
    });

    return () => {
      cancelled = true;
    };
    // `dayKey` rather than `selected` so picking a new *time* on the same day
    // does not refetch the grid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTimeSelect, physician, dayKey]);

  const label = selected
    ? showTimeSelect
      ? formatDateTime(selected).dateTime
      : formatDateTime(selected).dateOnly
    : (placeholder ?? "Select a date");

  function pickDay(day: Date | undefined) {
    if (!day) {
      onChange(undefined);
      return;
    }

    // Preserve an already-chosen time when only the day changes.
    const next = new Date(day);
    if (selected && showTimeSelect) {
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    } else {
      next.setHours(0, 0, 0, 0);
    }
    onChange(next);

    if (!showTimeSelect) setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <FormControl>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-required={required || undefined}
            className={cn(
              "shad-input h-11 w-full justify-start gap-2 border border-border bg-surface font-normal",
              !selected && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
      </FormControl>

      <PopoverContent className="w-auto p-3">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={pickDay}
          autoFocus
          captionLayout={variant === "birthdate" ? "dropdown" : "label"}
          /* Without navLayout the legacy layout is kept, and DayPicker's own
             docs note the tab order then stops matching the visual order once
             dropdowns are present — an accessibility regression introduced by
             the fix itself. */
          navLayout={variant === "birthdate" ? "after" : undefined}
          startMonth={fromDate}
          endMonth={toDate}
          disabled={
            fromDate || toDate
              ? [
                  ...(fromDate ? [{ before: fromDate }] : []),
                  ...(toDate ? [{ after: toDate }] : []),
                ]
              : undefined
          }
        />

        {showTimeSelect ? (
          <div className="mt-3 border-t border-border pt-3">
            {!physician ? (
              <p className="text-12-regular text-muted-foreground">
                Choose a doctor first to see available times.
              </p>
            ) : !selected ? (
              <p className="text-12-regular text-muted-foreground">
                Pick a day to see available times.
              </p>
            ) : isLoadingSlots || slots === null ? (
              <p className="text-12-regular flex items-center gap-2 text-muted-foreground">
                <Loader2Icon className="size-3.5 animate-spin" />
                Checking availability…
              </p>
            ) : slots.every((s) => !s.available) ? (
              <p className="text-12-regular text-muted-foreground">
                No times left on this day. Try another date.
              </p>
            ) : (
              <div
                className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto"
                role="group"
                aria-label="Available times"
              >
                {slots.map((slot) => {
                  const isActive =
                    selected &&
                    new Date(slot.value).getTime() === selected.getTime();

                  return (
                    <button
                      key={slot.value}
                      type="button"
                      disabled={!slot.available}
                      aria-pressed={Boolean(isActive)}
                      onClick={() => {
                        onChange(new Date(slot.value));
                        setOpen(false);
                      }}
                      className={cn(
                        "text-12-regular rounded-md border px-2 py-1.5 transition-colors",
                        slot.available
                          ? "border-border text-foreground hover:border-green-500 hover:bg-green-600"
                          : "cursor-not-allowed border-border/50 text-muted-foreground line-through",
                        isActive &&
                          "border-green-500 bg-green-500 text-white hover:bg-green-500",
                      )}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function parseDate(value: Date | string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
