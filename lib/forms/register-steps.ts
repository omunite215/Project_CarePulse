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
// Annotated (not `as const satisfies`) so every entry is contextually typed
// as RegisterStep: satisfies only checks compatibility and keeps each
// literal's own narrower shape, so an optional key present on one entry
// (e.g. `hint`, `optional`) is absent from the others' types and reading it
// off the union fails to compile.
//
// Non-empty tuple, not `RegisterStep[]`: under `noUncheckedIndexedAccess` a
// plain array makes every indexed read `| undefined`, which forced a non-null
// assertion just to reach the first step. A non-empty tuple tells the compiler
// index 0 exists, while `[i + 1]` correctly stays `| undefined` — the wizard's
// last step genuinely has no next, and that case should be handled, not
// asserted away.
export const REGISTER_STEPS: readonly [RegisterStep, ...RegisterStep[]] = [
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
];

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
