import type { PatientFormValues } from "@/lib/validation/patient";

export type RegisterStepId =
  | "personal"
  | "medical"
  | "identification"
  | "review";

export interface RegisterStep {
  id: RegisterStepId;
  /** Rendered as the section heading and in the step indicator. */
  title: string;
  /** Secondary line in the indicator. */
  hint?: string;
  fields: readonly (keyof PatientFormValues)[];
  /** Every field on the step is optional, so it offers a wholesale skip. */
  optional?: boolean;
}

/**
 * The wizard's single source of truth.
 *
 * This one array drives per-step validation, the step indicator, the review
 * summary and the error summary's links. Splitting those apart is how a field
 * ends up validated but unreachable, or reachable but never validated.
 */
export const REGISTER_STEPS = [
  {
    id: "personal",
    title: "Personal information",
    fields: [
      "name",
      "email",
      "phone",
      "birthDate",
      "gender",
      "address",
      "occupation",
      "emergencyContactName",
      "emergencyContactNumber",
    ],
  },
  {
    id: "medical",
    title: "Medical information",
    fields: [
      "primaryPhysician",
      "insuranceProvider",
      "insurancePolicyNumber",
      "allergies",
      "currentMedication",
      "familyMedicalHistory",
      "pastMedicalHistory",
    ],
  },
  {
    id: "identification",
    title: "Identification",
    hint: "Optional",
    optional: true,
    fields: [
      "identificationType",
      "identificationNumber",
      "identificationDocument",
    ],
  },
  {
    id: "review",
    title: "Review and consent",
    fields: ["treatmentConsent", "disclosureConsent", "privacyConsent"],
  },
] as const satisfies readonly RegisterStep[];

export const REGISTER_STEP_IDS = REGISTER_STEPS.map((step) => step.id);

export function stepIndexOf(id: RegisterStepId): number {
  return REGISTER_STEPS.findIndex((step) => step.id === id);
}

/** Which step a field belongs to — used to route an error back to its screen. */
export function stepOwningField(
  field: keyof PatientFormValues,
): RegisterStep {
  const step = REGISTER_STEPS.find((candidate) =>
    (candidate.fields as readonly string[]).includes(field),
  );

  // Unreachable while the coverage test above passes; throwing beats returning
  // step 1 and silently sending the user to the wrong screen.
  if (!step) throw new Error(`No wizard step owns the field "${field}"`);
  return step;
}
