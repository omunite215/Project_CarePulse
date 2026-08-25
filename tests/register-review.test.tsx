// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it } from "vitest";

import { LABELS, RegisterReview } from "@/components/forms/RegisterReview";
import {
  RegisterWizardProvider,
  useRegisterWizard,
} from "@/components/forms/RegisterWizardProvider";
import type { User } from "@/lib/data/types";
import {
  PatientFormValidation,
  type PatientFormValues,
} from "@/lib/validation/patient";

const user: User = {
  id: "user_1",
  name: "Jane Cooper",
  email: "jane@example.com",
  phone: "5551234567",
};

/** Rendered as checkboxes below the summary, not as summary rows. */
const CONSENT_FIELDS = new Set<string>([
  "treatmentConsent",
  "disclosureConsent",
  "privacyConsent",
]);

/**
 * Seeds two of the three identification fields, then renders the summary —
 * a patient who picked a type and typed a number but never uploaded a
 * document. The `setValue` calls run directly in the render body rather than
 * in an effect: `form.setValue` mutates react-hook-form's internal store
 * synchronously, so by the time `RegisterReview` (rendered right below, in
 * the same pass) calls `form.getValues()`, the values are already there —
 * no effect, no extra render, nothing to desynchronise.
 */
function PartiallyFilledIdentification() {
  const { form } = useRegisterWizard();
  form.setValue("identificationType", "Driver's License");
  form.setValue("identificationNumber", "A1234567");
  return <RegisterReview />;
}

/**
 * The provider is mounted with `?step=review`: that is the only step on
 * which the real wizard ever renders `RegisterReview`, and the wizard's step
 * is nuqs-owned URL state (see RegisterWizardProvider), not React state, so
 * it has to be seeded through the testing adapter rather than a prop.
 */
function renderReview() {
  return render(
    <NuqsTestingAdapter searchParams="?step=review">
      <RegisterWizardProvider user={user}>
        <RegisterReview />
      </RegisterWizardProvider>
    </NuqsTestingAdapter>,
  );
}

function renderPartiallyFilledIdentification() {
  return render(
    <NuqsTestingAdapter searchParams="?step=review">
      <RegisterWizardProvider user={user}>
        <PartiallyFilledIdentification />
      </RegisterWizardProvider>
    </NuqsTestingAdapter>,
  );
}

function identificationSection(): HTMLElement {
  const heading = screen.getByRole("heading", { name: "Identification" });
  const section = heading.closest("section");
  if (!section) throw new Error("Identification section not found");
  return section;
}

describe("RegisterReview", () => {
  it("has a LABELS entry for every non-consent schema field", () => {
    // Derived from the schema, not hardcoded, so a field added later fails
    // this test instead of silently never appearing in the summary.
    const fields = Object.keys(PatientFormValidation.shape).filter(
      (field) => !CONSENT_FIELDS.has(field),
    );

    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(LABELS[field as keyof PatientFormValues]).toEqual(
        expect.any(String),
      );
    }
  });

  it("lists all three identification fields when only some are filled, blanks reading 'Not provided'", () => {
    renderPartiallyFilledIdentification();

    const scoped = within(identificationSection());

    expect(scoped.getByText("Identification type")).toBeInTheDocument();
    expect(scoped.getByText("Driver's License")).toBeInTheDocument();

    expect(scoped.getByText("Identification number")).toBeInTheDocument();
    expect(scoped.getByText("A1234567")).toBeInTheDocument();

    expect(scoped.getByText("Scanned document")).toBeInTheDocument();
    expect(scoped.getByText("Not provided")).toBeInTheDocument();
  });

  it("shows the explanatory sentence, not rows, when identification is fully skipped", () => {
    renderReview();

    const scoped = within(identificationSection());

    expect(
      scoped.getByText(/you didn.t add an id document/i),
    ).toBeInTheDocument();
    expect(scoped.queryByText("Not provided")).not.toBeInTheDocument();
    expect(scoped.queryByText("Identification type")).not.toBeInTheDocument();
  });
});
