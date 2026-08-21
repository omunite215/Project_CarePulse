import { describe, expect, it } from "vitest";

import { CLINIC_HOURS, MIN_BOOKING_LEAD_MINUTES } from "@/constants";
import {
  buildDaySlots,
  isOnSlotGrid,
  validateSlot,
} from "@/lib/services/availability";

/**
 * Double-booking prevention. The client disables taken slots, but the Server
 * Action re-runs `validateSlot` because two people can pick the same slot
 * before either submits — that race is the whole reason this module is pure and
 * shared.
 */

function dayAt(hour: number, minute = 0, dayOffset = 1) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

describe("buildDaySlots", () => {
  it("covers the clinic's opening hours on the slot grid", () => {
    const slots = buildDaySlots(dayAt(0), []);
    const expected =
      ((CLINIC_HOURS.endHour - CLINIC_HOURS.startHour) * 60) /
      CLINIC_HOURS.slotMinutes;

    expect(slots).toHaveLength(expected);
    expect(slots[0]?.label).toMatch(/9:00\s?AM/);
  });

  it("marks a booked slot unavailable", () => {
    const taken = dayAt(11, 0);
    const slots = buildDaySlots(dayAt(0), [taken.toISOString()]);

    const match = slots.find((s) => s.value === taken.toISOString());
    expect(match?.available).toBe(false);
  });

  it("leaves other slots available", () => {
    const taken = dayAt(11, 0);
    const slots = buildDaySlots(dayAt(0), [taken.toISOString()]);

    const others = slots.filter((s) => s.value !== taken.toISOString());
    expect(others.every((s) => s.available)).toBe(true);
  });

  it("closes slots that fall inside the booking lead time", () => {
    const now = dayAt(12, 0, 0);
    const slots = buildDaySlots(now, [], now);

    const soon = slots.find((s) => new Date(s.value) < now);
    expect(soon?.available).toBe(false);
  });
});

describe("isOnSlotGrid", () => {
  it("accepts an on-grid time", () => {
    expect(isOnSlotGrid(dayAt(9, 30))).toBe(true);
  });

  it("rejects an off-grid minute", () => {
    expect(isOnSlotGrid(dayAt(9, 17))).toBe(false);
  });

  it("rejects a time before opening", () => {
    expect(isOnSlotGrid(dayAt(7, 0))).toBe(false);
  });

  it("rejects a time after closing", () => {
    expect(isOnSlotGrid(dayAt(19, 0))).toBe(false);
  });
});

describe("validateSlot", () => {
  it("accepts a free, on-grid, future slot", () => {
    expect(validateSlot(dayAt(10, 0), [])).toBeNull();
  });

  it("rejects a slot that is already taken", () => {
    const slot = dayAt(10, 0);
    const reason = validateSlot(slot, [slot.toISOString()]);
    expect(reason).toMatch(/just been taken/i);
  });

  it("rejects a slot inside the lead time", () => {
    const now = new Date();
    const tooSoon = new Date(
      now.getTime() + (MIN_BOOKING_LEAD_MINUTES - 10) * 60_000,
    );
    expect(validateSlot(tooSoon, [], now)).toMatch(/in advance/i);
  });

  it("rejects an invalid date", () => {
    expect(validateSlot(new Date("nonsense"), [])).toMatch(/not a valid/i);
  });

  it("ignores a cancelled slot's timestamp when it is not passed in", () => {
    // Cancelled appointments are excluded upstream by getBookedSlots, so the
    // slot reads as free here.
    expect(validateSlot(dayAt(13, 0), [])).toBeNull();
  });
});
