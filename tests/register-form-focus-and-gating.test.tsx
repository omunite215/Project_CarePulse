// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { beforeAll, describe, expect, it, vi } from "vitest";

import RegisterForm from "@/components/forms/RegisterForm";
import { RegisterWizardProvider } from "@/components/forms/RegisterWizardProvider";
import type { User } from "@/lib/data/types";

/**
 * I-1's gate lives in `goNext`'s `recordFailedAttempt()` call and
 * `onInvalid`'s equivalent — both in `RegisterForm` itself, not
 * `FormErrorSummary` alone — so a harness that stubs those out would only
 * prove the harness correct, not the real wizard.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

// Empty on purpose: onboarding normally seeds name/email/phone, but leaving
// them blank here means step 1's "Continue" has more than one field to fail
// on, matching a patient who reached registration with nothing filled in yet.
const emptyUser: User = { id: "user_1", name: "", email: "", phone: "" };

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
