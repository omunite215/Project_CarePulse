// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { useEffect, useRef } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import RegisterForm from "@/components/forms/RegisterForm";
import {
  RegisterWizardProvider,
  useRegisterWizard,
} from "@/components/forms/RegisterWizardProvider";
import type { User } from "@/lib/data/types";

/**
 * I-1 (gating) and I-2 (focus on step change) both require mounting the real
 * `RegisterForm` — `goNext`'s `recordFailedAttempt()` call, `onInvalid`'s
 * routing, and the heading-focus effect all live there, not in
 * `FormErrorSummary` alone, so a harness that stubs those out would only
 * prove the harness correct, not the real wizard.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

// Empty on purpose: onboarding normally seeds name/email/phone, but leaving
// them blank here means step 1's "Continue" has more than one field to fail
// on, matching a patient who reached registration with nothing filled in yet.
const emptyUser: User = { id: "user_1", name: "", email: "", phone: "" };

/**
 * Seeds every field `goNext` validates on step 1 with a schema-valid value,
 * rather than driving each input through the DOM — a real
 * calendar/radio-group/phone-input interaction is exercised elsewhere
 * (`tests/e2e/flows.spec.ts`); this test only needs step 1 to actually pass
 * validation so "Continue" succeeds.
 *
 * In an effect, not the render body: unlike `register-review.test.tsx`'s
 * `PartiallyFilledIdentification` (two `setValue` calls, read back
 * synchronously in the same pass via `form.getValues()`), this seeds nine
 * fields purely to satisfy a later DOM interaction (clicking "Continue"),
 * with no same-render read — exactly the "synchronize with an external
 * system" case effects, not render bodies, are for.
 */
function PersonalStepFilledValidly() {
  const { form } = useRegisterWizard();
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    form.setValue("name", "Ada Lovelace");
    form.setValue("email", "ada@example.com");
    form.setValue("phone", "+12025551234");
    form.setValue("birthDate", new Date(1991, 3, 18));
    form.setValue("gender", "female");
    form.setValue("address", "418 Maple Street, Springfield, IL");
    form.setValue("occupation", "Mathematician");
    form.setValue("emergencyContactName", "Charles Babbage");
    form.setValue("emergencyContactNumber", "+12025559876");
  }, [form]);

  return <RegisterForm />;
}

function renderStep1() {
  return render(
    <NuqsTestingAdapter>
      <RegisterWizardProvider user={emptyUser}>
        <RegisterForm />
      </RegisterWizardProvider>
    </NuqsTestingAdapter>,
  );
}

describe("FormErrorSummary gating (I-1)", () => {
  // RegisterWizardProvider.setStep calls window.scrollTo, which jsdom only
  // stubs with a "Not implemented" console warning — a gap in jsdom's own
  // coverage, not a real signal about this code (same stub used in
  // form-error-summary.test.tsx).
  beforeAll(() => {
    window.scrollTo = () => {};
  });

  it("stays absent after a plain blur, even though the blurred field is now invalid", async () => {
    renderStep1();

    const address = screen.getByLabelText(/^address/i);
    fireEvent.focus(address);
    fireEvent.blur(address);

    // The field's own inline message (mode: "onTouched") confirms the blur
    // actually registered an error — without this, the summary being absent
    // would prove nothing (there might just be no error yet).
    await screen.findByText(/enter your full address, including the town/i);

    // The GOV.UK-style summary heading text — distinct from the per-field
    // <FormMessage>, which also carries role="alert" and would otherwise
    // make a bare `queryByRole("alert")` assertion pass even with a broken
    // gate (see the finding this test exists to catch).
    expect(
      screen.queryByText(/answers? need.? your attention/i),
    ).not.toBeInTheDocument();
  });

  it("appears, and is focused, after a failed Continue", async () => {
    renderStep1();

    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    const heading = await screen.findByText(
      /answers? need.? your attention/i,
    );
    const summary = heading.closest("[aria-labelledby]");
    expect(summary).not.toBeNull();
    await waitFor(() => expect(summary).toHaveFocus());

    // Still on step 1: a blocked "Continue" must not advance.
    expect(
      screen.getByRole("heading", { name: "Personal information" }),
    ).toBeInTheDocument();
  });
});

describe("focus follows the step (I-2)", () => {
  beforeAll(() => {
    window.scrollTo = () => {};
  });

  it("moves focus to the next step's heading after a successful Continue", async () => {
    render(
      <NuqsTestingAdapter>
        <RegisterWizardProvider user={emptyUser}>
          <PersonalStepFilledValidly />
        </RegisterWizardProvider>
      </NuqsTestingAdapter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    const medicalHeading = await screen.findByRole("heading", {
      name: "Medical information",
    });
    await waitFor(() => expect(medicalHeading).toHaveFocus());
  });

  it("focuses the error summary, not the routed-to step's heading, when a failed submit routes there", async () => {
    render(
      <NuqsTestingAdapter searchParams="?step=review">
        <RegisterWizardProvider user={emptyUser}>
          <RegisterForm />
        </RegisterWizardProvider>
      </NuqsTestingAdapter>,
    );

    await screen.findByRole("heading", { name: "Consent and privacy" });
    fireEvent.click(screen.getByLabelText(/consent to receive treatment/i));
    fireEvent.click(screen.getByLabelText(/use and disclosure/i));
    fireEvent.click(screen.getByLabelText(/privacy policy/i));
    fireEvent.click(
      screen.getByRole("button", { name: /complete registration/i }),
    );

    // The whole-schema submit fails on fields left on step 1 (name, email,
    // birthDate, address, and more, all still blank), so the wizard must
    // route back there — the exact dead end `onInvalid` exists to avoid.
    const personalHeading = await screen.findByRole("heading", {
      name: "Personal information",
    });

    const summaryHeading = await screen.findByText(
      /answers? need.? your attention/i,
    );
    const summary = summaryHeading.closest("[aria-labelledby]");
    expect(summary).not.toBeNull();

    await waitFor(() => expect(summary).toHaveFocus());
    // Exactly one focus move: the heading that the step-change effect would
    // otherwise have focused must not also have it.
    expect(personalHeading).not.toHaveFocus();
  });
});
