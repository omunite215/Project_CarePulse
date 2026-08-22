"use client";

import Image from "next/image";

import { AppointmentModal } from "@/components/AppointmentModal";
import { StatusBadge } from "@/components/StatusBadge";
import { findDoctor } from "@/constants";
import type { Appointment } from "@/lib/data/types";
import { formatDateTime } from "@/lib/utils";

/**
 * One appointment, as a card, for viewports below `md`.
 *
 * The table needs ~975px before its seven columns stop colliding, so on a phone
 * it scrolled sideways and put Schedule and Cancel — the only two things an
 * operator does here — furthest off-screen. This is the same information with
 * the actions first-class.
 *
 * Deliberately mirrors `components/patient/AppointmentCard.tsx` rather than
 * reusing it: that one owns patient-side reschedule/cancel dialogs and its own
 * state, while this is a read-only projection with admin actions.
 */
export function AppointmentRowCard({
  appointment,
}: {
  appointment: Appointment;
}) {
  const doctor = findDoctor(appointment.primaryPhysician);

  // Separators come from `divide-y` on the parent list, not a per-card
  // border — `border-b last:border-b-0` sets the same property twice.
  // `<li>`, not `<article>`: the parent is now a real `<ul>` (see DataTable),
  // and a list of list items is what gives assistive tech "2 of 10".
  return (
    <li className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-14-medium truncate text-foreground">
            {appointment.patient.name}
          </p>
          <p className="text-12-regular truncate text-muted-foreground">
            {appointment.patient.email}
          </p>
        </div>
        <StatusBadge status={appointment.status} />
      </div>

      <dl className="mt-3 space-y-1.5">
        <div className="flex gap-2">
          <dt className="text-12-regular text-muted-foreground">When</dt>
          <dd className="text-12-regular text-foreground">
            {formatDateTime(appointment.schedule).dateTime}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-12-regular text-muted-foreground">Doctor</dt>
          <dd className="text-12-regular flex items-center gap-2 text-foreground">
            {doctor ? (
              <Image
                src={doctor.image}
                alt=""
                aria-hidden="true"
                width={100}
                height={100}
                className="size-6 rounded-full border border-border"
              />
            ) : null}
            Dr. {appointment.primaryPhysician}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-12-regular shrink-0 text-muted-foreground">Reason</dt>
          <dd className="text-12-regular text-foreground/80">
            {appointment.reason}
          </dd>
        </div>
      </dl>

      {appointment.status === "cancelled" ? (
        <p className="text-12-regular mt-3 text-muted-foreground">No actions</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <AppointmentModal
            type="schedule"
            userId={appointment.userId}
            appointment={appointment}
          />
          <AppointmentModal
            type="cancel"
            userId={appointment.userId}
            appointment={appointment}
          />
        </div>
      )}
    </li>
  );
}
