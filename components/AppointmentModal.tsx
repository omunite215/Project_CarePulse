"use client";

import { useState } from "react";

import AppointmentForm from "@/components/forms/AppointmentForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Appointment } from "@/lib/data/types";
import { cn, formatDateTime } from "@/lib/utils";

interface AppointmentModalProps {
  type: "schedule" | "cancel";
  userId: string;
  appointment: Appointment;
}

/**
 * Per-row Schedule / Cancel dialog.
 *
 * Reuses `AppointmentForm` in its update modes rather than duplicating the
 * doctor picker and slot grid — the same server-side availability re-check
 * therefore applies to a reschedule.
 */
export function AppointmentModal({
  type,
  userId,
  appointment,
}: AppointmentModalProps) {
  const [open, setOpen] = useState(false);

  const label = type === "schedule" ? "Schedule" : "Cancel";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "capitalize",
            type === "schedule" ? "text-brand" : "text-destructive",
          )}
        >
          {label}
          {/* The visible label alone reads as "Schedule" on every row; naming
              the patient makes each button distinguishable out of context. */}
          <span className="sr-only"> appointment for {appointment.patient.name}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="shad-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{label} appointment</DialogTitle>
          <DialogDescription>
            {type === "schedule"
              ? `Confirm a time for ${appointment.patient.name}. They will be texted the details.`
              : `Cancel ${appointment.patient.name}'s appointment on ${formatDateTime(appointment.schedule).dateTime}. They will be texted the reason.`}
          </DialogDescription>
        </DialogHeader>

        <AppointmentForm
          type={type}
          userId={userId}
          appointment={appointment}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
