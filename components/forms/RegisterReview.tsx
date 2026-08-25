"use client";

import { useRegisterWizard } from "@/components/forms/RegisterWizardProvider";
import { Button } from "@/components/ui/button";
import { GenderLabels } from "@/constants";
import { REGISTER_STEPS } from "@/lib/forms/register-steps";
import type { PatientFormValues } from "@/lib/validation/patient";
import { formatDateTime } from "@/lib/utils";

/** Labels for the summary. Deliberately the field's full wording, not an
 *  abbreviation — in a consent summary the exact phrasing is the thing being
 *  agreed to. */
export const LABELS: Partial<Record<keyof PatientFormValues, string>> = {
  name: "Full name",
  email: "Email",
  phone: "Phone number",
  birthDate: "Date of birth",
  gender: "Gender",
  address: "Address",
  occupation: "Occupation",
  emergencyContactName: "Emergency contact name",
  emergencyContactNumber: "Emergency contact number",
  primaryPhysician: "Primary care physician",
  insuranceProvider: "Insurance provider",
  insurancePolicyNumber: "Insurance policy number",
  allergies: "Allergies",
  currentMedication: "Current medication",
  familyMedicalHistory: "Family medical history",
  pastMedicalHistory: "Past medical history",
  identificationType: "Identification type",
  identificationNumber: "Identification number",
  identificationDocument: "Scanned document",
};

function display(name: keyof PatientFormValues, value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (name === "birthDate" && value instanceof Date) {
    return formatDateTime(value).dateOnly;
  }
  if (name === "gender" && typeof value === "string") {
    return GenderLabels[value as keyof typeof GenderLabels] ?? value;
  }
  if (name === "identificationDocument") {
    // `files[0]` stays `File | undefined` under noUncheckedIndexedAccess even
    // after the length check above narrows nothing for index access — reading
    // the element once and branching on it (rather than `files[0].name`) is
    // the non-`!` way to get at it.
    const first = (value as File[])[0];
    return first ? first.name : null;
  }
  return String(value);
}

export function RegisterReview() {
  const { form, setStep } = useRegisterWizard();
  const values = form.getValues();

  // Everything except the review step itself, which holds only the consents
  // rendered below the summary.
  const summarised = REGISTER_STEPS.filter((step) => step.id !== "review");

  return (
    <div className="space-y-4">
      {summarised.map((step) => {
        // Every field is listed, blank or not: a summary that quietly omits
        // an unanswered optional field lets someone consent without ever
        // seeing it was blank. Replacing the rows wholesale is reserved for
        // the case below, where the entire step was skipped and a sentence
        // says so plainly.
        const rows = step.fields.map((name) => ({
          name,
          text: display(name, values[name]),
        }));

        const allEmpty = rows.every((row) => row.text === null);

        return (
          <section
            key={step.id}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-14-medium text-foreground">{step.title}</h2>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-green-500"
                onClick={() => setStep(step.id)}
              >
                {allEmpty ? "Add" : "Edit"}
                <span className="sr-only"> {step.title}</span>
              </Button>
            </div>

            {allEmpty && step.optional ? (
              <p className="text-12-regular text-muted-foreground">
                You didn&apos;t add an ID document. You can still register — the
                clinic may ask for it at your visit.
              </p>
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                {rows.map((row) => (
                  <div key={row.name} className="min-w-0">
                    <dt className="text-12-regular font-bold uppercase text-muted-foreground">
                      {LABELS[row.name]}
                    </dt>
                    {/* wrap-break-word, not truncate: four of these fields
                        accept 500 characters, and a summary that hides what
                        you are consenting to is not a summary. */}
                    <dd className="text-14-regular wrap-break-word text-foreground">
                      {row.text ?? (
                        <span className="italic text-muted-foreground">
                          Not provided
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        );
      })}
    </div>
  );
}
