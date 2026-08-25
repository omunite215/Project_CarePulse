// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { useEffect, useRef } from "react";
import { describe, expect, it } from "vitest";

import { FormErrorSummary } from "@/components/forms/FormErrorSummary";
import {
  RegisterWizardProvider,
  useRegisterWizard,
} from "@/components/forms/RegisterWizardProvider";
import type { User } from "@/lib/data/types";

const user: User = {
  id: "user_1",
  name: "Jane Cooper",
  email: "jane@example.com",
  phone: "5551234567",
};

/**
 * Fails three fields from three different steps via `form.trigger`, one at a
 * time, awaited in the reverse of wizard order — review's field first,
 * medical's second, personal's last.
 *
 * `form.setError` was tried first and rejected: react-hook-form silently
 * no-ops it for a field that has never been registered, and this test never
 * mounts the real `CustomFormField` inputs (confirmed against a throwaway
 * repro before writing this). `trigger(name)` runs the actual zodResolver
 * path instead, which does not have that requirement — it is also a more
 * honest stand-in for a real failed validation than a hand-set error would
 * be. `email` is cleared first because the seeded default (the signed-in
 * user's own address) is valid; the other two fail already on
 * `PatientFormDefaultValues` (`primaryPhysician: ""`, `privacyConsent:
 * false`), so only that one needs a value change before triggering.
 *
 * Each call is awaited before the next starts, so the insertion order in
 * `formState.errors` is exactly the call order. If the summary listed
 * `Object.keys(errors)` in that order instead of wizard order, it would read
 * review, medical, personal — the reverse of what the test below asserts.
 */
function SeedErrorsOutOfOrder() {
  const { form } = useRegisterWizard();
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;

    void (async () => {
      await form.trigger("privacyConsent");
      await form.trigger("primaryPhysician");
      form.setValue("email", "");
      await form.trigger("email");
    })();
  }, [form]);

  return <FormErrorSummary />;
}

function renderWithErrors() {
  return render(
    <NuqsTestingAdapter searchParams="?step=review">
      <RegisterWizardProvider user={user}>
        <SeedErrorsOutOfOrder />
      </RegisterWizardProvider>
    </NuqsTestingAdapter>,
  );
}

function renderWithoutErrors() {
  return render(
    <NuqsTestingAdapter searchParams="?step=review">
      <RegisterWizardProvider user={user}>
        <FormErrorSummary />
      </RegisterWizardProvider>
    </NuqsTestingAdapter>,
  );
}

describe("FormErrorSummary", () => {
  it("renders nothing when there are no errors", () => {
    renderWithoutErrors();

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("lists errors in wizard order, not the order they were triggered", async () => {
    renderWithErrors();

    // The three `trigger` calls settle independently, so wait for all three
    // entries before asserting order — otherwise this could read the DOM
    // between the first and second resolving and compare a short list.
    await waitFor(() => {
      expect(screen.getAllByRole("button")).toHaveLength(3);
    });

    // personal (email) -> medical (primaryPhysician) -> review (privacyConsent),
    // per REGISTER_STEPS — the reverse of the trigger order above.
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Invalid email address",
      "Select a doctor",
      "You must consent to privacy in order to proceed",
    ]);
  });

  it("counts every listed error in the heading", async () => {
    renderWithErrors();

    expect(
      await screen.findByRole("heading", {
        name: "3 answers need your attention",
      }),
    ).toBeInTheDocument();
  });
});
