"use server";

import { revalidatePath } from "next/cache";

import { getRepository } from "@/lib/data";
import type {
  Appointment,
  AppointmentListResult,
  AppointmentQuery,
  TimeSlot,
} from "@/lib/data/types";
import { AppError } from "@/lib/errors";
import {
  cancelledMessage,
  scheduledMessage,
  sendSmsNotification,
} from "@/lib/services/notifications";
import { buildDaySlots, validateSlot } from "@/lib/services/availability";
import {
  CancelAppointmentSchema,
  CreateAppointmentSchema,
  ScheduleAppointmentSchema,
} from "@/lib/validation/appointment";
import { type ActionResult, parseOrThrow, run } from "./result";

export async function createAppointment(input: {
  userId: string;
  patientId: string;
  values: unknown;
}): Promise<ActionResult<Appointment>> {
  return run(async () => {
    const values = parseOrThrow(CreateAppointmentSchema, input.values);
    const repo = await getRepository();

    // Re-check availability server-side. The client disables taken slots, but
    // two people can pick the same one before either submits.
    const booked = await repo.getBookedSlots(
      values.primaryPhysician,
      values.schedule.toISOString(),
    );
    const problem = validateSlot(values.schedule, booked);
    if (problem) {
      throw AppError.validation(problem, { schedule: problem });
    }

    const appointment = await repo.createAppointment({
      userId: input.userId,
      patientId: input.patientId,
      primaryPhysician: values.primaryPhysician,
      schedule: values.schedule.toISOString(),
      reason: values.reason,
      note: values.note || null,
      status: "pending",
    });

    revalidatePath("/admin");
    revalidatePath(`/patients/${input.userId}/appointments`);
    return appointment;
  });
}

export async function getAppointment(
  appointmentId: string,
): Promise<ActionResult<Appointment | null>> {
  return run(async () => {
    const repo = await getRepository();
    return repo.getAppointment(appointmentId);
  });
}

export async function listAppointments(
  query: AppointmentQuery = {},
): Promise<ActionResult<AppointmentListResult>> {
  return run(async () => {
    const repo = await getRepository();
    return repo.listAppointments(query);
  });
}

export async function listMyAppointments(
  userId: string,
): Promise<ActionResult<Appointment[]>> {
  return run(async () => {
    const repo = await getRepository();
    return repo.listAppointmentsByUser(userId);
  });
}

/**
 * Confirms or cancels an appointment and texts the patient.
 *
 * SMS is best-effort: a messaging failure must not undo a successful
 * reschedule, so it is reported alongside the updated appointment rather than
 * thrown.
 */
export async function updateAppointment(input: {
  appointmentId: string;
  type: "schedule" | "cancel";
  values: unknown;
}): Promise<ActionResult<{ appointment: Appointment; smsSent: boolean }>> {
  return run(async () => {
    const schema =
      input.type === "cancel"
        ? CancelAppointmentSchema
        : ScheduleAppointmentSchema;
    const values = parseOrThrow(schema, input.values);

    const repo = await getRepository();
    const existing = await repo.getAppointment(input.appointmentId);
    if (!existing) throw AppError.notFound("Appointment");

    if (input.type === "schedule") {
      const booked = (
        await repo.getBookedSlots(
          values.primaryPhysician,
          values.schedule.toISOString(),
        )
      ).filter((iso) => iso !== existing.schedule);

      const problem = validateSlot(values.schedule, booked);
      if (problem) {
        throw AppError.validation(problem, { schedule: problem });
      }
    }

    const appointment = await repo.updateAppointment(input.appointmentId, {
      primaryPhysician: values.primaryPhysician,
      schedule: values.schedule.toISOString(),
      status: input.type === "cancel" ? "cancelled" : "scheduled",
      cancellationReason:
        input.type === "cancel" ? (values.cancellationReason ?? null) : null,
    });

    const message =
      input.type === "cancel"
        ? cancelledMessage(
            appointment.schedule,
            appointment.cancellationReason ?? "No reason given",
          )
        : scheduledMessage(appointment.schedule, appointment.primaryPhysician);

    const notification = await sendSmsNotification(appointment.userId, message);

    revalidatePath("/admin");
    revalidatePath(`/patients/${appointment.userId}/appointments`);

    return { appointment, smsSent: notification.sent };
  });
}

/** Slot grid for the picker, with taken slots already marked unavailable. */
export async function getAvailability(input: {
  physician: string;
  day: string;
}): Promise<ActionResult<TimeSlot[]>> {
  return run(async () => {
    if (!input.physician) return [];
    const repo = await getRepository();
    const booked = await repo.getBookedSlots(input.physician, input.day);
    return buildDaySlots(new Date(input.day), booked);
  });
}
