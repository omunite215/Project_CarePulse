// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import CustomFormField, { FormFieldType } from "@/components/CustomFormField";
import { FieldRequirements } from "@/components/forms/FieldRequirements";
import { Form } from "@/components/ui/form";
import {
  PatientFormValidation,
  type PatientFormValues,
} from "@/lib/validation/patient";

/**
 * `withSchema` toggles the `<FieldRequirements>` provider on and off. The
 * provider is what RegisterForm adds and AppointmentForm/PatientForm do not,
 * so exercising both states here is what proves a field name that happens to
 * collide with `PatientFormValidation` (e.g. `primaryPhysician`, `name`) is
 * only treated as required inside the form that actually opted in.
 */
function Harness({
  name,
  label,
  withSchema = true,
}: {
  name: keyof PatientFormValues;
  label: string;
  withSchema?: boolean;
}) {
  const form = useForm<PatientFormValues>();
  const field = (
    <CustomFormField
      fieldType={FormFieldType.INPUT}
      control={form.control}
      name={name}
      label={label}
    />
  );

  return (
    <Form {...form}>
      {withSchema ? (
        <FieldRequirements schema={PatientFormValidation}>
          {field}
        </FieldRequirements>
      ) : (
        field
      )}
    </Form>
  );
}

describe("CustomFormField required semantics", () => {
  it("marks a required field with an asterisk hidden from assistive tech", () => {
    render(<Harness name="address" label="Address" />);

    const input = screen.getByLabelText(/address/i);
    expect(input).toHaveAttribute("aria-required", "true");

    // The asterisk is decorative; screen readers would otherwise announce it
    // as punctuation ("Address star").
    const marker = screen.getByText("*");
    expect(marker).toHaveAttribute("aria-hidden", "true");
  });

  it("carries the requirement in text for screen readers", () => {
    render(<Harness name="address" label="Address" />);
    expect(screen.getByText("(required)")).toBeInTheDocument();
  });

  it("marks an optional field neither way", () => {
    render(<Harness name="allergies" label="Allergies" />);

    const input = screen.getByLabelText(/allergies/i);
    expect(input).not.toHaveAttribute("aria-required", "true");
    expect(screen.queryByText("*")).not.toBeInTheDocument();
    expect(screen.queryByText("(required)")).not.toBeInTheDocument();
  });

  it("treats a schema-required field as optional with no FieldRequirements provider", () => {
    // "address" is required in PatientFormValidation, so this would be a
    // false negative for the whole point of scoping the derivation per form:
    // without a provider, a form must not inherit another form's rules just
    // because it happens to reuse a field name.
    render(<Harness name="address" label="Address" withSchema={false} />);

    const input = screen.getByLabelText(/address/i);
    expect(input).not.toHaveAttribute("aria-required", "true");
    expect(screen.queryByText("*")).not.toBeInTheDocument();
    expect(screen.queryByText("(required)")).not.toBeInTheDocument();
  });
});
