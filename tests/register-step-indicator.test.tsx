// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it } from "vitest";

import { RegisterStepIndicator } from "@/components/forms/RegisterStepIndicator";
import { RegisterWizardProvider } from "@/components/forms/RegisterWizardProvider";
import type { User } from "@/lib/data/types";

const user: User = {
  id: "user_1",
  name: "Jane Cooper",
  email: "jane@example.com",
  phone: "5551234567",
};

/**
 * `step` is nuqs-owned URL state (see RegisterWizardProvider), so exercising
 * a step other than the first means seeding the adapter's search params
 * rather than reaching into component state.
 */
function renderIndicator(searchParams?: string) {
  return render(
    <NuqsTestingAdapter searchParams={searchParams}>
      <RegisterWizardProvider user={user}>
        <RegisterStepIndicator />
      </RegisterWizardProvider>
    </NuqsTestingAdapter>,
  );
}

describe("RegisterStepIndicator", () => {
  it("marks the first step current and shows no completed steps", () => {
    renderIndicator();

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("aria-current", "step");
    for (const item of items.slice(1)) {
      expect(item).not.toHaveAttribute("aria-current");
    }
    expect(
      document.querySelectorAll('[data-slot="step-done-icon"]'),
    ).toHaveLength(0);
  });

  it("marks a later step current and earlier steps done", () => {
    // personal(0) and medical(1) precede "identification"(2) in
    // REGISTER_STEPS, so both should render as done.
    renderIndicator("?step=identification");

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);

    const current = items.filter(
      (item) => item.getAttribute("aria-current") === "step",
    );
    expect(current).toHaveLength(1);
    expect(current[0]).toBe(items[2]);

    expect(
      items[0]?.querySelector('[data-slot="step-done-icon"]'),
    ).not.toBeNull();
    expect(
      items[1]?.querySelector('[data-slot="step-done-icon"]'),
    ).not.toBeNull();
    expect(
      items[2]?.querySelector('[data-slot="step-done-icon"]'),
    ).toBeNull();
    expect(
      items[3]?.querySelector('[data-slot="step-done-icon"]'),
    ).toBeNull();
    expect(items[3]).not.toHaveAttribute("aria-current");
  });
});
