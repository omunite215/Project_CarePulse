"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import CustomFormField, { FormFieldType } from "@/components/CustomFormField";
import SubmitButton from "@/components/SubmitButton";
import { Form } from "@/components/ui/form";
import { SelectItem } from "@/components/ui/select";
import { Doctors } from "@/constants";
import {
  createAppointment,
  updateAppointment,
} from "@/lib/actions/appointment.actions";
import type { Appointment } from "@/lib/data/types";
import { applyServerErrors, toastSuccess } from "@/lib/forms/apply-server-errors";
import {
  type AppointmentFormType,
  getAppointmentSchema,
} from "@/lib/validation/appointment";

interface AppointmentFormProps {
  type: AppointmentFormType;
  userId: string;
  patientId?: string;
  appointment?: Appointment;
  /** Closes the containing dialog on success. */
  onDone?: () => void;
}

type Values = {
  primaryPhysician: string;
  schedule: Date;
  reason?: string;
  note?: string;
  cancellationReason?: string;
};

/**
 * One form, three modes: book, confirm, cancel.
 *
 * The date field is given the selected physician so the slot grid can show that
 * doctor's real availability. The server re-checks on submit — see
 * `lib/services/availability.ts`.
 */
export default function AppointmentForm({
  type,
  userId,
  patientId,
  appointment,
  onDone,
}: AppointmentFormProps) {
  const router = useRouter();

  const form = useForm<Values>({
    resolver: zodResolver(getAppointmentSchema(type)),
    defaultValues: {
      primaryPhysician: appointment?.primaryPhysician ?? "",
      schedule: appointment
        ? new Date(appointment.schedule)
        : (undefined as unknown as Date),
      reason: appointment?.reason ?? "",
      note: appointment?.note ?? "",
      cancellationReason: appointment?.cancellationReason ?? "",
    },
  });

  const selectedPhysician = form.watch("primaryPhysician");

  async function onSubmit(values: Values) {
    if (type === "create") {
      if (!patientId) {
        applyServerErrors(form, {
          ok: false,
          error: {
            code: "VALIDATION",
            message: "Complete registration before booking.",
          },
        });
        return;
      }

      const result = await createAppointment({
        userId,
        patientId,
        values,
      });

      if (!result.ok) {
        applyServerErrors(form, result);
        return;
      }

      router.push(
        `/patients/${userId}/new-appointment/success?appointmentId=${result.data.id}`,
      );
      return;
    }

    if (!appointment) return;

    const result = await updateAppointment({
      appointmentId: appointment.id,
      type,
      values,
    });

    if (!result.ok) {
      applyServerErrors(form, result);
      return;
    }

    toastSuccess(
      type === "cancel"
        ? result.data.smsSent
          ? "Appointment cancelled. The patient has been texted."
          : "Appointment cancelled, but the SMS could not be sent."
        : result.data.smsSent
          ? "Appointment confirmed. The patient has been texted."
          : "Appointment confirmed, but the SMS could not be sent.",
    );

    form.reset();
    onDone?.();
    router.refresh();
  }

  const label =
    type === "cancel"
      ? "Cancel appointment"
      : type === "schedule"
        ? "Confirm appointment"
        : "Book appointment";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-6">
        {type === "create" ? (
          <section className="mb-8 space-y-4">
            <h1 className="header">New appointment</h1>
            <p className="text-foreground/80">
              Request an appointment in under a minute.
            </p>
          </section>
        ) : null}

        {type !== "cancel" ? (
          <>
            <CustomFormField
              fieldType={FormFieldType.SELECT}
              control={form.control}
              name="primaryPhysician"
              label="Doctor"
              placeholder="Select a doctor"
            >
              {Doctors.map((doctor) => (
                <SelectItem
                  key={doctor.name}
                  value={doctor.name}
                  className="shad-combobox-item"
                >
                  <span className="flex cursor-pointer items-center gap-2">
                    <Image
                      src={doctor.image}
                      width={32}
                      height={32}
                      alt=""
                      aria-hidden="true"
                      className="rounded-full border border-border"
                    />
                    Dr. {doctor.name}
                  </span>
                </SelectItem>
              ))}
            </CustomFormField>

            <CustomFormField
              fieldType={FormFieldType.DATE_PICKER}
              control={form.control}
              name="schedule"
              label="Date and time"
              placeholder="Pick a slot"
              showTimeSelect
              physician={selectedPhysician}
              fromDate={new Date()}
              description={
                selectedPhysician
                  ? "Times already booked with this doctor are struck through."
                  : "Choose a doctor to see available times."
              }
            />

            {type === "create" ? (
              <div className="grid gap-6 md:grid-cols-2">
                <CustomFormField
                  fieldType={FormFieldType.TEXTAREA}
                  control={form.control}
                  name="reason"
                  label="Reason for appointment"
                  placeholder="Annual check-up, persistent headaches…"
                />
                <CustomFormField
                  fieldType={FormFieldType.TEXTAREA}
                  control={form.control}
                  name="note"
                  label="Anything else we should know?"
                  placeholder="Prefer a morning slot"
                />
              </div>
            ) : null}
          </>
        ) : (
          <CustomFormField
            fieldType={FormFieldType.TEXTAREA}
            control={form.control}
            name="cancellationReason"
            label="Reason for cancellation"
            placeholder="Doctor unavailable, patient rescheduled…"
          />
        )}

        <SubmitButton
          isLoading={form.formState.isSubmitting}
          loadingLabel="Working…"
          className={
            type === "cancel" ? "shad-danger-btn w-full" : "shad-primary-btn w-full"
          }
        >
          {label}
        </SubmitButton>
      </form>
    </Form>
  );
}
