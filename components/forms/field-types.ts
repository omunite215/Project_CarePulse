/**
 * Field-type tokens.
 *
 * These lived in `components/forms/PatientForm.tsx` AND were re-declared
 * verbatim in `RegisterForm.tsx`, while `CustomFormField` imported the enum
 * from `PatientForm` — a components↔forms import cycle that oxlint's
 * `import/no-cycle` flags. Worse, TypeScript enums are nominally typed, so
 * `RegisterForm`'s copy was not assignable to the parameter typed against
 * `PatientForm`'s copy: three type errors from one duplicated declaration.
 *
 * A `const` object with a derived union avoids the nominal-typing trap entirely
 * and erases at compile time, unlike an enum.
 */
export const FormFieldType = {
  INPUT: "input",
  TEXTAREA: "textarea",
  PHONE_INPUT: "phoneInput",
  CHECKBOX: "checkbox",
  DATE_PICKER: "datePicker",
  SELECT: "select",
  SKELETON: "skeleton",
} as const;

export type FormFieldType = (typeof FormFieldType)[keyof typeof FormFieldType];
