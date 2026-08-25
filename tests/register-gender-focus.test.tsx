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
 * I-3: `gender` renders through `CustomFormField`'s SKELETON branch, which
 * forwarded no ref before this fix — `form.setFocus("gender")` was a silent
 * no-op. Clicking its entry in the error summary would switch to the right
 * step (personal, where gender already lives — it's the current step here,
 * so `goToField` doesn't even need to switch) and then land focus nowhere.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const user: User = {
  id: "user_1",
  name: "Jane Cooper",
  email: "jane@example.com",
  phone: "5551234567",
};

/** Fails `gender` via the real resolver, then records a failed attempt so
 *  `FormErrorSummary` actually renders (see I-1's gate). */
function SeedGenderError() {
  const { form, recordFailedAttempt } = useRegisterWizard();
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    void form.trigger("gender").then(() => recordFailedAttempt());
  }, [form, recordFailedAttempt]);

  return null;
}

describe("gender field focus from the error summary (I-3)", () => {
  beforeAll(() => {
    window.scrollTo = () => {};
  });

  it("moves focus to a gender radio when its error-summary entry is clicked", async () => {
    render(
      <NuqsTestingAdapter>
        <RegisterWizardProvider user={user}>
          <SeedGenderError />
          <RegisterForm />
        </RegisterWizardProvider>
      </NuqsTestingAdapter>,
    );

    const entry = await screen.findByRole("button", {
      name: /select a gender/i,
    });
    fireEvent.click(entry);

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    // react-hook-form's own `setFocus` wraps the `.focus()` call in a
    // `setTimeout`, so this is not observable synchronously after the click.
    await waitFor(() => expect(radios[0]).toHaveFocus());
  });
});
