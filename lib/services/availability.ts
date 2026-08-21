import { CLINIC_HOURS, MIN_BOOKING_LEAD_MINUTES } from "@/constants";
import type { TimeSlot } from "@/lib/data/types";

/**
 * Slot generation for the appointment picker.
 *
 * Pure and dependency-free so it can be unit tested and reused on both sides of
 * the network boundary: the client renders the grid, and the Server Action
 * re-checks the chosen slot before writing. Client-side checking alone loses the
 * race between two people booking the same slot.
 */

/** All slots for a given day, marked available or not. */
export function buildDaySlots(
  day: Date,
  bookedIso: readonly string[],
  now: Date = new Date(),
): TimeSlot[] {
  const booked = new Set(
    bookedIso.map((iso) => new Date(iso).toISOString()),
  );
  const earliest = new Date(now.getTime() + MIN_BOOKING_LEAD_MINUTES * 60_000);

  const slots: TimeSlot[] = [];
  const { startHour, endHour, slotMinutes } = CLINIC_HOURS;

  for (let hour = startHour; hour < endHour; hour += 1) {
    for (let minute = 0; minute < 60; minute += slotMinutes) {
      const slot = new Date(day);
      slot.setHours(hour, minute, 0, 0);

      const iso = slot.toISOString();
      const available = !booked.has(iso) && slot >= earliest;

      slots.push({
        value: iso,
        label: slot.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
        available,
      });
    }
  }

  return slots;
}

/** True when a chosen timestamp lands on the clinic's slot grid. */
export function isOnSlotGrid(date: Date): boolean {
  const { startHour, endHour, slotMinutes } = CLINIC_HOURS;
  const hour = date.getHours();
  const minute = date.getMinutes();

  return (
    hour >= startHour &&
    hour < endHour &&
    minute % slotMinutes === 0 &&
    date.getSeconds() === 0
  );
}

/**
 * Server-side gate. Returns a human-readable reason, or null when bookable.
 */
export function validateSlot(
  schedule: Date,
  bookedIso: readonly string[],
  now: Date = new Date(),
): string | null {
  if (Number.isNaN(schedule.getTime())) {
    return "That is not a valid date and time.";
  }

  const earliest = new Date(now.getTime() + MIN_BOOKING_LEAD_MINUTES * 60_000);
  if (schedule < earliest) {
    return `Appointments must be booked at least ${MIN_BOOKING_LEAD_MINUTES} minutes in advance.`;
  }

  if (!isOnSlotGrid(schedule)) {
    const { startHour, endHour } = CLINIC_HOURS;
    return `Pick a slot between ${formatHour(startHour)} and ${formatHour(endHour)}.`;
  }

  const target = schedule.toISOString();
  if (bookedIso.some((iso) => new Date(iso).toISOString() === target)) {
    return "That slot has just been taken. Please choose another.";
  }

  return null;
}

function formatHour(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${suffix}`;
}
