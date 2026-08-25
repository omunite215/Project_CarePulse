// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { useEffect, useRef } from "react";
import { beforeAll, describe, expect, it } from "vitest";

import CustomFormField, { FormFieldType } from "@/components/CustomFormField";
import { FormErrorSummary } from "@/components/forms/FormErrorSummary";
import {
  RegisterWizardProvider,
  useRegisterWizard,
} from "@/components/forms/RegisterWizardProvider";
import { SelectItem } from "@/components/ui/select";
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

/**
 * Renders each step's own field the way `RegisterForm` does — conditional on
 * `step`, not always mounted — so `goToField`'s step switch and `setFocus`
 * have a real DOM node to land on instead of nothing.
 *
 * Declared as a sibling placed *before* `<SeedErrorsOutOfOrder>` (and
 * therefore before `<FormErrorSummary>`) in every render call below, mirroring
 * `RegisterForm.tsx`'s own ordering: the step sections come first, the
 * summary last. React flushes a commit's mount effects in tree order, so on
 * the same commit that switches to "medical", this component's field must
 * register with react-hook-form before `FormErrorSummary`'s post-switch
 * `setFocus` effect runs — reversing the two would make the cross-step test
 * below fail for a reason that has nothing to do with the code under test.
 */
function StepAwareFields() {
  const { form, step } = useRegisterWizard();
  return (
    <>
      {step === "medical" ? (
        <CustomFormField
          fieldType={FormFieldType.SELECT}
          control={form.control}
          name="primaryPhysician"
          label="Primary care physician"
          placeholder="Select a doctor"
        >
          <SelectItem value="Dr. Test">Dr. Test</SelectItem>
        </CustomFormField>
      ) : null}
      {step === "review" ? (
        <CustomFormField
          fieldType={FormFieldType.CHECKBOX}
          control={form.control}
          name="privacyConsent"
          checkboxLabel="I acknowledge that I have reviewed and agree to the privacy policy."
        />
      ) : null}
    </>
  );
}

function renderWithErrorsAndFields() {
  return render(
    <NuqsTestingAdapter searchParams="?step=review">
      <RegisterWizardProvider user={user}>
        <StepAwareFields />
        <SeedErrorsOutOfOrder />
      </RegisterWizardProvider>
    </NuqsTestingAdapter>,
  );
}

describe("clicking a summary entry", () => {
  // `RegisterWizardProvider.setStep` calls `window.scrollTo`, which jsdom
  // implements only as a stub that logs "Not implemented" on every call.
  // That is a gap in jsdom's own DOM coverage, not a real warning about this
  // code, so it is stubbed out here rather than left to spam the run.
  beforeAll(() => {
    window.scrollTo = () => {};
  });

  it("switches to the field's own step and focuses it there, when that field lives on another step", async () => {
    renderWithErrorsAndFields();

    await waitFor(() => {
      expect(screen.getAllByRole("button")).toHaveLength(3);
    });

    // "primaryPhysician" belongs to the medical step; the wizard is on
    // review. Its SELECT field is not in the DOM yet — StepAwareFields only
    // mounts it once `step` actually becomes "medical".
    fireEvent.click(screen.getByRole("button", { name: "Select a doctor" }));

    const trigger = await screen.findByRole("combobox", {
      name: /primary care physician/i,
    });
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("moves focus to the checkbox itself for a non-INPUT field — the review step's consent checkboxes", async () => {
    renderWithErrorsAndFields();

    await waitFor(() => {
      expect(screen.getAllByRole("button")).toHaveLength(3);
    });

    // "privacyConsent" already lives on the current (review) step, so this
    // exercises the direct `form.setFocus` branch of `goToField` rather than
    // the cross-step one above — isolating the CHECKBOX ref-forwarding fix
    // from the step-switch machinery.
    fireEvent.click(
      screen.getByRole("button", {
        name: "You must consent to privacy in order to proceed",
      }),
    );

    const checkbox = screen.getByRole("checkbox", {
      name: /privacy policy/i,
    });
    // react-hook-form's own `setFocus` wraps the `.focus()` call in a
    // `setTimeout`, so the focus move is not observable synchronously after
    // the click.
    await waitFor(() => expect(checkbox).toHaveFocus());
  });
});
