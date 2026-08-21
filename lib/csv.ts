import type { Appointment } from "@/lib/data/types";
import { formatDateTime } from "@/lib/utils";

/**
 * CSV export. No dependency needed — `Blob` and an object URL are enough.
 */

const HEADERS = [
  "Appointment ID",
  "Patient",
  "Email",
  "Phone",
  "Doctor",
  "Scheduled for",
  "Status",
  "Reason",
  "Note",
  "Cancellation reason",
  "Created",
] as const;

/**
 * Escapes a CSV field.
 *
 * The leading-apostrophe guard matters: a value starting with `=`, `+`, `-` or
 * `@` is interpreted as a formula by Excel and Sheets, which turns a patient's
 * free-text "reason" field into a CSV injection vector.
 */
function escapeField(value: string | null | undefined): string {
  const text = value ?? "";
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replaceAll('"', '""')}"`;
}

export function appointmentsToCsv(appointments: Appointment[]): string {
  const rows = appointments.map((a) =>
    [
      a.id,
      a.patient.name,
      a.patient.email,
      a.patient.phone,
      `Dr. ${a.primaryPhysician}`,
      formatDateTime(a.schedule).dateTime,
      a.status,
      a.reason,
      a.note,
      a.cancellationReason,
      formatDateTime(a.createdAt).dateTime,
    ]
      .map(escapeField)
      .join(","),
  );

  // BOM so Excel opens UTF-8 correctly instead of mangling accented names.
  return `﻿${HEADERS.map(escapeField).join(",")}\n${rows.join("\n")}`;
}

/** Browser-only: triggers a download of the given CSV text. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  // Without revoking, every export leaks the whole file for the page's lifetime.
  URL.revokeObjectURL(url);
}
