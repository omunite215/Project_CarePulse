"use client";

import { createContext, useContext, type ReactNode } from "react";

import {
  isRequiredField,
  type FieldShapeSource,
} from "@/lib/forms/required-fields";

/**
 * Field names are not unique across forms — `AppointmentForm` and `PatientForm`
 * both reuse names (`primaryPhysician`, `name`, `email`, `phone`) that also
 * appear, and are required, in `PatientFormValidation`. A single global lookup
 * against one schema would mark a field required by another form's rules
 * purely because the names collide. Scoping the schema to this provider means
 * a form only gets required-derivation once it explicitly wraps itself with
 * its own schema; every other form is unaffected by default.
 */
const FieldRequirementsContext = createContext<FieldShapeSource | null>(null);

export function FieldRequirements({
  schema,
  children,
}: {
  schema: FieldShapeSource;
  children: ReactNode;
}) {
  return (
    <FieldRequirementsContext.Provider value={schema}>
      {children}
    </FieldRequirementsContext.Provider>
  );
}

/**
 * Resolves to `false` with no provider in the tree. That is what keeps
 * `AppointmentForm` and `PatientForm` pixel-identical today — they render no
 * `<FieldRequirements>` at all — and lets either opt in later with a single
 * wrapper instead of a `required` prop repeated at every call site.
 */
export function useFieldRequired(name: string): boolean {
  const schema = useContext(FieldRequirementsContext);
  if (!schema) return false;
  return isRequiredField(schema, name);
}
