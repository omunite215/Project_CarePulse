"use client";

import Image from "next/image";
import { useState } from "react";

import AppointmentForm from "@/components/forms/AppointmentForm";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { findDoctor } from "@/constants";
import type { Appointment } from "@/lib/data/types";
import { formatDateTime } from "@/lib/utils";

/**
 * A patient's own appointment, with self-serve reschedule and cancel.
 *
 * The reference implementation gave patients no way to see an appointment after
 * booking it — everything past the success page was admin-only.
 */
export function AppointmentCard({
  appointment,
  userId,
}: {
  appointment: Appointment;
  userId: string;
}) {
  const [mode, setMode] = useState<"schedule" | "cancel" | null>(null);
  const doctor = findDoctor(appointment.primaryPhysician);

  const isPast = new Date(appointment.schedule) < new Date();
  const isClosed = appointment.status === "cancelled";
  // Nothing to change about an appointment that has already happened or been
  // cancelled, so the actions come off rather than sitting there dead.
  const canModify = !isClosed && !isPast;

  return (
    <article className="rounded-xl border border-border bg-surface/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {doctor ? (
            <Image
              src={doctor.image}
              alt=""
              aria-hidden="true"
              width={100}
              height={100}
              className="size-11 rounded-full border border-border"
            />
          ) : null}
          <div>
            <p className="text-16-semibold text-foreground">
              Dr. {appointment.primaryPhysician}
            </p>
            <p className="text-14-regular text-muted-foreground">
              {formatDateTime(appointment.schedule).dateTime}
            </p>
          </div>
        </div>

        <StatusBadge status={appointment.status} />
      </div>

      <dl className="mt-4 space-y-1">
        <div className="flex gap-2">
          <dt className="text-12-regular text-muted-foreground">Reason:</dt>
          <dd className="text-12-regular text-foreground/80">{appointment.reason}</dd>
        </div>
        {appointment.cancellationReason ? (
          <div className="flex gap-2">
            <dt className="text-12-regular text-muted-foreground">Cancelled because:</dt>
            <dd className="text-12-regular text-red-500">
              {appointment.cancellationReason}
            </dd>
          </div>
        ) : null}
      </dl>

      {canModify ? (
        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="shad-gray-btn"
            onClick={() => setMode("schedule")}
          >
            Reschedule
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500"
            onClick={() => setMode("cancel")}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <p className="text-12-regular mt-4 text-muted-foreground">
          {isClosed
            ? "This appointment was cancelled."
            : "This appointment has passed."}
        </p>
      )}

      <Dialog open={mode !== null} onOpenChange={() => setMode(null)}>
        <DialogContent className="shad-dialog sm:max-w-md">
          {mode ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {mode === "cancel" ? "Cancel appointment" : "Reschedule"}
                </DialogTitle>
                <DialogDescription>
                  {mode === "cancel"
                    ? "Let us know why so we can free the slot for someone else."
                    : "Pick a new time. Slots already taken are struck through."}
                </DialogDescription>
              </DialogHeader>

              <AppointmentForm
                type={mode}
                userId={userId}
                appointment={appointment}
                onDone={() => setMode(null)}
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </article>
  );
}
