import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The project's custom typography utilities (`text-14-medium`, `text-32-bold`, …)
 * each set font-size, line-height AND font-weight at once. tailwind-merge has no
 * idea they exist, so out of the box it would never dedupe them against
 * `text-lg` / `leading-6` / `font-bold`.
 *
 * Registering them as their own group — mutually conflicting with the three
 * built-in groups they overlap — makes `cn("text-14-regular", "text-lg")`
 * resolve to `text-lg` instead of emitting both and letting source order decide.
 */
const TYPOGRAPHY_UTILITIES = [
  "text-36-bold",
  "text-32-bold",
  "text-24-bold",
  "text-18-bold",
  "text-16-semibold",
  "text-16-regular",
  "text-14-medium",
  "text-14-regular",
  "text-12-semibold",
  "text-12-regular",
] as const;

// The generic registers "cp-type" as a valid class-group id; without it
// tailwind-merge's config type only accepts its own built-in group names.
const twMerge = extendTailwindMerge<"cp-type">({
  extend: {
    classGroups: {
      "cp-type": [...TYPOGRAPHY_UTILITIES],
    },
    conflictingClassGroups: {
      "cp-type": ["font-size", "leading", "font-weight"],
      "font-size": ["cp-type"],
      leading: ["cp-type"],
      "font-weight": ["cp-type"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats a date into the four shapes the UI needs. */
export function formatDateTime(date: Date | string, timeZone?: string) {
  const value = typeof date === "string" ? new Date(date) : date;

  if (Number.isNaN(value.getTime())) {
    return { dateTime: "—", dateDay: "—", dateOnly: "—", timeOnly: "—" };
  }

  const base: Intl.DateTimeFormatOptions = timeZone ? { timeZone } : {};

  return {
    dateTime: value.toLocaleString("en-US", {
      ...base,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    }),
    dateDay: value.toLocaleString("en-US", {
      ...base,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    dateOnly: value.toLocaleString("en-US", {
      ...base,
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    timeOnly: value.toLocaleString("en-US", {
      ...base,
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    }),
  };
}

/** Browser-only: object URL for previewing a picked file. */
export function convertFileToUrl(file: File) {
  return URL.createObjectURL(file);
}

/** Bytes → human readable, for file-upload validation messages. */
export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Stable sleep used by the demo repository to make latency look real. */
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
