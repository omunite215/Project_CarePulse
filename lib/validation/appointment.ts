import { z } from "zod";

// Same wording as the registration schema. The wizard's copy pass settled on
// saying what to do rather than what went wrong, and this form asks for the
// same thing — it was simply outside that pass's scope.
const physician = z
  .string()
  .min(2, { error: "Choose the doctor you would like to see" });

/**
 * `z.date()`, not `z.coerce.date()`.
 *
 * Next serialises Server Action arguments with a superset of JSON that preserves
 * `Date`, so the picker's Date arrives at the action still a Date — no coercion
 * needed. Using `z.coerce` here would widen the schema's *input* type to
 * `unknown`, which then refuses to line up with react-hook-form's generics.
 *
 * The patient schema does still coerce `birthDate`, because that payload really
 * is `JSON.stringify`d (it travels alongside a File in FormData) and arrives as
 * a string.
 */
const schedule = z.date({ error: "Pick a date and time" });

const reasonRequired = z
  .string()
  .trim()
  .min(2, { error: "Reason must be at least 2 characters" })
  .max(500, { error: "Reason must be at most 500 characters" });

const cancellationRequired = z
  .string()
  .trim()
  .min(2, { error: "Reason must be at least 2 characters" })
  .max(500, { error: "Reason must be at most 500 characters" });

export const CreateAppointmentSchema = z.object({
  primaryPhysician: physician,
  schedule,
  reason: reasonRequired,
  note: z.string().max(500).optional(),
  cancellationReason: z.string().max(500).optional(),
});

export const ScheduleAppointmentSchema = z.object({
  primaryPhysician: physician,
  schedule,
  reason: z.string().max(500).optional(),
  note: z.string().max(500).optional(),
  cancellationReason: z.string().max(500).optional(),
});

export const CancelAppointmentSchema = z.object({
  primaryPhysician: physician,
  schedule,
  reason: z.string().max(500).optional(),
  note: z.string().max(500).optional(),
  cancellationReason: cancellationRequired,
});

export type AppointmentFormType = "create" | "schedule" | "cancel";

export function getAppointmentSchema(type: AppointmentFormType) {
  switch (type) {
    case "create":
      return CreateAppointmentSchema;
    case "cancel":
      return CancelAppointmentSchema;
    default:
      return ScheduleAppointmentSchema;
  }
}

export type AppointmentFormValues = z.infer<typeof CreateAppointmentSchema>;

/** Maps the form mode onto the status the appointment should end up in. */
export const STATUS_FOR_FORM_TYPE = {
  create: "pending",
  schedule: "scheduled",
  cancel: "cancelled",
} as const;
