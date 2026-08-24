import { describe, expect, it } from "vitest";

import {
  REGISTER_STEPS,
  stepIndexOf,
  stepOwningField,
} from "@/lib/forms/register-steps";
import { PatientFormValidation } from "@/lib/validation/patient";

describe("REGISTER_STEPS", () => {
  /**
   * The guard that matters. Adding a 23rd field to the schema without
   * assigning it to a step would otherwise drop it from the wizard silently —
   * it would never render, never validate, and submit as undefined.
   */
  it("covers every schema field exactly once", () => {
    const assigned = REGISTER_STEPS.flatMap((step) => [...step.fields]).sort();
    const schemaKeys = Object.keys(PatientFormValidation.shape).sort();

    expect(assigned).toEqual(schemaKeys);
    expect(new Set(assigned).size).toBe(assigned.length);
  });

  it("puts consent on the review step, so it is ticked after the summary", () => {
    const review = REGISTER_STEPS.at(-1);
    expect(review?.id).toBe("review");
    expect([...(review?.fields ?? [])]).toEqual([
      "treatmentConsent",
      "disclosureConsent",
      "privacyConsent",
    ]);
  });

  it("marks only the identification step optional", () => {
    const optional = REGISTER_STEPS.filter((step) => step.optional);
    expect(optional.map((step) => step.id)).toEqual(["identification"]);
  });

  it("resolves a field back to its owning step", () => {
    expect(stepOwningField("allergies").id).toBe("medical");
    expect(stepOwningField("privacyConsent").id).toBe("review");
    expect(stepIndexOf("identification")).toBe(2);
  });
});
