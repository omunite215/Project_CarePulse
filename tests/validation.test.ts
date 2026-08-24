import { describe, expect, it } from "vitest";

import {
  PatientFormDefaultValues,
  PatientFormValidation,
} from "@/lib/validation/patient";
import { UserFormValidation } from "@/lib/validation/user";
import {
  CancelAppointmentSchema,
  CreateAppointmentSchema,
  getAppointmentSchema,
} from "@/lib/validation/appointment";

/**
 * These lock in the Zod 4 migration decisions, especially the consent
 * checkboxes — the Zod 3 spelling (`.default(false).refine(v => v === true)`)
 * does not carry over and was silently unsatisfiable.
 */

describe("UserFormValidation", () => {
  it("accepts a valid onboarding payload", () => {
    const result = UserFormValidation.safeParse({
      name: "Jane Cooper",
      email: "jane@example.com",
      phone: "+12025550143",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a phone number that is not E.164", () => {
    const result = UserFormValidation.safeParse({
      name: "Jane Cooper",
      email: "jane@example.com",
      phone: "2025550143",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Invalid phone number");
  });

  it("rejects a one-character name", () => {
    const result = UserFormValidation.safeParse({
      name: "J",
      email: "jane@example.com",
      phone: "+12025550143",
    });
    expect(result.success).toBe(false);
  });

  it("uses z.email(), not the removed z.string().email()", () => {
    const result = UserFormValidation.safeParse({
      name: "Jane Cooper",
      email: "not-an-email",
      phone: "+12025550143",
    });
    expect(result.error?.issues[0]?.message).toBe("Invalid email address");
  });
});

describe("PatientFormValidation consent", () => {
  const valid = {
    ...PatientFormDefaultValues,
    name: "Jane Cooper",
    email: "jane@example.com",
    phone: "+12025550143",
    // Stated explicitly: the defaults deliberately no longer supply these.
    birthDate: new Date("1991-04-18"),
    gender: "female" as const,
    address: "418 Maple Street",
    occupation: "Engineer",
    emergencyContactName: "Michael Cooper",
    emergencyContactNumber: "+12025550144",
    primaryPhysician: "John Green",
    insuranceProvider: "Blue Shield",
    insurancePolicyNumber: "POL-123456",
    treatmentConsent: true,
    disclosureConsent: true,
    privacyConsent: true,
  };

  it("accepts a fully consented form", () => {
    const result = PatientFormValidation.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it.each([
    ["treatmentConsent", "You must consent to treatment in order to proceed"],
    ["disclosureConsent", "You must consent to disclosure in order to proceed"],
    ["privacyConsent", "You must consent to privacy in order to proceed"],
  ])("rejects an unticked %s with its own message", (field, message) => {
    const result = PatientFormValidation.safeParse({
      ...valid,
      [field]: false,
    });
    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) => i.path[0] === field);
    expect(issue?.message).toBe(message);
  });

  it("rejects a future date of birth", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);

    const result = PatientFormValidation.safeParse({
      ...valid,
      birthDate: future,
    });
    expect(result.success).toBe(false);
  });

  it("requires a real Date, not a string", () => {
    // `z.date()` rather than `z.coerce.date()`: the value goes to a Server
    // Action, whose serialiser preserves Date. Coercing would widen the
    // schema's input type to `unknown` and break react-hook-form's generics.
    expect(
      PatientFormValidation.safeParse({
        ...valid,
        birthDate: new Date("1991-04-18"),
      }).success,
    ).toBe(true);

    expect(
      PatientFormValidation.safeParse({ ...valid, birthDate: "1991-04-18" })
        .success,
    ).toBe(false);
  });

  it("uses lowercase gender values to match the Appwrite enum", () => {
    expect(
      PatientFormValidation.safeParse({ ...valid, gender: "female" }).success,
    ).toBe(true);
    expect(
      PatientFormValidation.safeParse({ ...valid, gender: "Female" }).success,
    ).toBe(false);
  });

  it("ships defaults that pre-answer nothing", () => {
    expect(PatientFormDefaultValues.treatmentConsent).toBe(false);
    expect(PatientFormDefaultValues.disclosureConsent).toBe(false);
    expect(PatientFormDefaultValues.privacyConsent).toBe(false);

    /*
     * These three used to arrive answered. `birthDate` defaulted to today —
     * and because DateField renders any truthy value as a formatted date, the
     * field looked filled in, the placeholder never showed, and
     * `date <= new Date()` accepted it. A patient who ignored the field was
     * registered as born today. `gender` defaulted to "male" and
     * `identificationType` to "Birth Certificate", in a section that is
     * entirely optional.
     */
    expect(PatientFormDefaultValues.birthDate).toBeUndefined();
    expect(PatientFormDefaultValues.gender).toBeUndefined();
    expect(PatientFormDefaultValues.identificationType).toBe("");
  });

  it("rejects the shipped defaults as an incomplete submission", () => {
    // The whole point: defaults must not be a valid patient record.
    expect(PatientFormValidation.safeParse(PatientFormDefaultValues).success).toBe(
      false,
    );
  });
});

describe("appointment schemas", () => {
  const base = {
    primaryPhysician: "John Green",
    schedule: new Date("2026-09-01T10:00:00.000Z"),
  };

  it("requires a reason to create", () => {
    expect(CreateAppointmentSchema.safeParse(base).success).toBe(false);
    expect(
      CreateAppointmentSchema.safeParse({ ...base, reason: "Check-up" })
        .success,
    ).toBe(true);
  });

  it("requires a cancellation reason to cancel", () => {
    expect(CancelAppointmentSchema.safeParse(base).success).toBe(false);
    expect(
      CancelAppointmentSchema.safeParse({
        ...base,
        cancellationReason: "No longer needed",
      }).success,
    ).toBe(true);
  });

  it("does not require a reason to schedule", () => {
    expect(getAppointmentSchema("schedule").safeParse(base).success).toBe(true);
  });

  it("maps unknown form types onto the schedule schema", () => {
    expect(getAppointmentSchema("schedule")).toBe(
      getAppointmentSchema("schedule"),
    );
  });
});
