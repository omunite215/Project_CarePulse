// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
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

// Module scope, like `Harness` above: oxlint's consistent-function-scoping
// flags a component defined inside `describe` because it captures nothing
// from that scope, so nesting it there only costs a re-creation per call.
function TextareaHarness() {
  const form = useForm<PatientFormValues>({
    defaultValues: { allergies: "Peanuts" },
  });
  return (
    <Form {...form}>
      <CustomFormField
        fieldType={FormFieldType.TEXTAREA}
        control={form.control}
        name="allergies"
        label="Allergies"
        maxLength={500}
        description="Maximum 500 characters."
      />
    </Form>
  );
}

describe("textarea character counter", () => {
  it("counts the current value against the limit", () => {
    render(<TextareaHarness />);
    expect(screen.getByText("7 / 500")).toBeInTheDocument();
  });

  it("hides the counter from assistive tech", () => {
    render(<TextareaHarness />);
    // A live count would be announced on every keystroke, which is the
    // standard screen-reader failure mode for counters. The limit is carried
    // by the field description instead.
    const counter = screen.getByText("7 / 500");
    expect(counter).toHaveAttribute("aria-hidden", "true");
    // aria-hidden alone would not stop a future `aria-live` from re-announcing the
    // count on every keystroke — the exact failure this element is shaped to avoid.
    expect(counter).not.toHaveAttribute("aria-live");
    expect(counter).not.toHaveAttribute("role");
    expect(screen.getByText("Maximum 500 characters.")).toBeInTheDocument();
  });
});

// Module scope, same reason as `TextareaHarness` above.
function DatePickerHarness({ variant }: { variant?: "default" | "birthdate" }) {
  const form = useForm<PatientFormValues>();
  return (
    <Form {...form}>
      <CustomFormField
        fieldType={FormFieldType.DATE_PICKER}
        control={form.control}
        name="birthDate"
        label="Date of birth"
        placeholder="Select your date of birth"
        variant={variant}
      />
    </Form>
  );
}

describe("date picker variant wiring", () => {
  // Pins `CustomFormField`'s `variant={props.variant}` forward to `DateField`
  // (see RegisterForm's birthDate field). Nothing else — not lint, not
  // typecheck — fails if that forward is dropped; only the rendered DOM does.
  it("renders month and year <select>s once the popover opens with variant=\"birthdate\"", () => {
    render(<DatePickerHarness variant="birthdate" />);

    // The button's accessible name comes from the associated <FormLabel>
    // ("Date of birth"), not its visible placeholder span — the label's
    // `for`/`id` association wins over content.
    fireEvent.click(screen.getByRole("button", { name: /date of birth/i }));

    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(2);
    for (const select of selects) {
      expect(select.tagName).toBe("SELECT");
    }
  });

  it("renders no <select> at all once the popover opens with no variant", () => {
    render(<DatePickerHarness />);

    fireEvent.click(screen.getByRole("button", { name: /date of birth/i }));

    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });
});
