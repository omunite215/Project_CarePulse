import {
  PatientFormValidation,
  type PatientFormValues,
} from "@/lib/validation/patient";

/**
 * Whether a field must be answered, derived from the schema itself.
 *
 * The alternative — a `required` prop on all 22 call sites — is a second
 * source of truth that can drift from the validation rules. This form has
 * already shipped once with a three-field component validated against a
 * 22-field schema; a derived value cannot repeat that.
 *
 * `safeParse(undefined)` rather than Zod's `.isOptional()`: it is behaviour
 * rather than an internal API, so it holds across Zod minor versions and is
 * correct for every wrapper in this schema — `.optional()`, `z.date()`,
 * `z.enum`, and `consentSchema`'s bare `.refine()`.
 */
export function isRequiredField(name: keyof PatientFormValues): boolean {
  const shape: Record<string, { safeParse: (value: unknown) => { success: boolean } }> =
    PatientFormValidation.shape;

  const schema = shape[name];
  if (!schema) return false;

  return !schema.safeParse(undefined).success;
}
