import type { DefaultValues } from "react-hook-form";
import { z } from "zod";

import { GENDERS } from "@/lib/data/types";
import {
  consentSchema,
  emailSchema,
  personNameSchema,
  phoneSchema,
} from "./primitives";

/**
 * The full registration form.
 *
 * Gender is lowercase to match the Appwrite enum attribute. The original schema
 * used capitalised `["Male","Female","Other"]` while the reference backend
 * stored lowercase, which would have failed on write.
 */
export const PatientFormValidation = z.object({
  // Personal
  name: personNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  // `z.date()` rather than `z.coerce.date()`: the value is handed to a Server
  // Action, and Next's action serialiser preserves Date. Coercing would widen
  // the schema's *input* type to `unknown`, which then refuses to line up with
  // react-hook-form's generics.
  birthDate: z
    .date({ error: "Select your date of birth" })
    .refine((date) => date <= new Date(), {
      error: "Date of birth cannot be in the future",
    }),
  gender: z.enum(GENDERS, { error: "Select a gender" }),
  address: z
    .string()
    .trim()
    .min(5, { error: "Enter your full address, including the town" })
    .max(500, { error: "Address must be at most 500 characters" }),
  occupation: z
    .string()
    .trim()
    .min(2, { error: "Occupation must be at least 2 characters" })
    .max(500, { error: "Occupation must be at most 500 characters" }),
  emergencyContactName: personNameSchema,
  emergencyContactNumber: phoneSchema,

  // Medical
  primaryPhysician: z
    .string()
    .min(2, { error: "Choose the doctor you would like to see" }),
  insuranceProvider: z
    .string()
    .trim()
    .min(2, { error: "Insurance name must be at least 2 characters" })
    .max(50, { error: "Insurance name must be at most 50 characters" }),
  insurancePolicyNumber: z
    .string()
    .trim()
    .min(2, { error: "Policy number must be at least 2 characters" })
    .max(50, { error: "Policy number must be at most 50 characters" }),
  // Trimmed like every other string field: without it a lone spacebar press
  // submits a value the schema counts as answered and a human cannot see.
  allergies: z.string().trim().max(500).optional(),
  currentMedication: z.string().trim().max(500).optional(),
  familyMedicalHistory: z.string().trim().max(500).optional(),
  pastMedicalHistory: z.string().trim().max(500).optional(),

  // Identification
  identificationType: z.string().optional(),
  identificationNumber: z.string().trim().max(50).optional(),
  identificationDocument: z.custom<File[]>().optional(),

  // Consent
  treatmentConsent: consentSchema(
    "You must consent to treatment in order to proceed",
  ),
  disclosureConsent: consentSchema(
    "You must consent to disclosure in order to proceed",
  ),
  privacyConsent: consentSchema(
    "You must consent to privacy in order to proceed",
  ),
});

export type PatientFormValues = z.infer<typeof PatientFormValidation>;

/**
 * Field defaults for the register form.
 *
 * Typed `DefaultValues<PatientFormValues>` rather than `PatientFormValues`,
 * because three fields deliberately start empty and the output type cannot
 * hold `undefined` for a required key.
 *
 * Nothing here answers a question on the patient's behalf. `birthDate` used to
 * default to today and `gender` to "male" — both then submitted as fact by
 * anyone who did not notice. `identificationType` is `""` rather than
 * `undefined` because SelectField maps a falsy value to "no selection" and
 * renders the placeholder.
 */
export const PatientFormDefaultValues: DefaultValues<PatientFormValues> = {
  name: "",
  email: "",
  phone: "",
  birthDate: undefined,
  gender: undefined,
  address: "",
  occupation: "",
  emergencyContactName: "",
  emergencyContactNumber: "",
  primaryPhysician: "",
  insuranceProvider: "",
  insurancePolicyNumber: "",
  allergies: "",
  currentMedication: "",
  familyMedicalHistory: "",
  pastMedicalHistory: "",
  identificationType: "",
  identificationNumber: "",
  identificationDocument: [],
  treatmentConsent: false,
  disclosureConsent: false,
  privacyConsent: false,
};
