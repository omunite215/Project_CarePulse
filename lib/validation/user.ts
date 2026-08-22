import { z } from "zod";

import { emailSchema, personNameSchema, phoneSchema } from "./primitives";

/**
 * The onboarding form: three fields, nothing more.
 *
 * The original code pointed this form at the 22-field `PatientFormValidation`,
 * so submitting was impossible — twenty required fields were never rendered.
 */
export const UserFormValidation = z.object({
  name: personNameSchema,
  email: emailSchema,
  phone: phoneSchema,
});

export type UserFormValues = z.infer<typeof UserFormValidation>;
