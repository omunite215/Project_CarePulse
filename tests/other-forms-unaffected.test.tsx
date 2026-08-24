// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AppointmentForm from "@/components/forms/AppointmentForm";
import PatientForm from "@/components/forms/PatientForm";

/**
 * `isRequiredField` is keyed by field *name*, not by which form is asking.
 * `AppointmentForm`'s `primaryPhysician` and `PatientForm`'s `name`/`email`/
 * `phone` all happen to also be required keys in `PatientFormValidation` — so
 * a global lookup against that schema would star them by coincidence. Neither
 * form renders a `<FieldRequirements>` provider, and `useFieldRequired`
 * resolves to `false` with none in the tree, which is what this test pins:
 * not "the code looks right" but the actual rendered output has zero markers.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

describe("forms without a FieldRequirements provider", () => {
  it("renders AppointmentForm with no required markers despite sharing field names with PatientFormValidation", () => {
    const { container } = render(
      <AppointmentForm type="create" userId="user_1" patientId="patient_1" />,
    );

    // "Doctor" -> primaryPhysician, a required key in PatientFormValidation.
    expect(screen.getByText("Doctor")).toBeInTheDocument();
    expect(container.querySelector("[aria-required='true']")).toBeNull();
    expect(screen.queryByText("*")).not.toBeInTheDocument();
    expect(screen.queryByText("(required)")).not.toBeInTheDocument();
  });

  it("renders PatientForm with no required markers despite sharing field names with PatientFormValidation", () => {
    const { container } = render(<PatientForm />);

    // name/email/phone are all required keys in PatientFormValidation.
    expect(screen.getByText("Full name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Phone number")).toBeInTheDocument();
    expect(container.querySelector("[aria-required='true']")).toBeNull();
    expect(screen.queryByText("*")).not.toBeInTheDocument();
    expect(screen.queryByText("(required)")).not.toBeInTheDocument();
  });
});
