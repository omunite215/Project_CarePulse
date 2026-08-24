/**
 * The only capability needed: a bag of per-field schemas that can be parsed.
 * Structural rather than `ZodObject<...>` so callers are not forced to line up
 * Zod's generics, which differ between a plain object schema and a refined one.
 */
export interface FieldShapeSource {
  shape: Record<string, { safeParse: (value: unknown) => { success: boolean } }>;
}

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
 *
 * Takes the schema as a parameter rather than importing `PatientFormValidation`
 * directly: field names are not unique across forms (`AppointmentForm` and
 * `PatientForm` both reuse names like `primaryPhysician`, `name`, `email` and
 * `phone`), so a hardcoded schema would answer for the wrong form whenever
 * another form happened to share a field name — starring a field one form
 * requires and another does not.
 */
export function isRequiredField(schema: FieldShapeSource, name: string): boolean {
  const field = schema.shape[name];
  if (!field) return false;

  return !field.safeParse(undefined).success;
}
