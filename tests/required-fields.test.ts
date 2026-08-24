import { describe, expect, it } from "vitest";

import { isRequiredField } from "@/lib/forms/required-fields";
import { PatientFormValidation } from "@/lib/validation/patient";

/**
 * Pinned explicitly rather than derived a second way. The point of writing the
 * expected answer down is that a schema change which flips a field's
 * optionality shows up here as a diff, instead of silently moving an asterisk.
 */
const REQUIRED = [
  "address",
  "birthDate",
  "disclosureConsent",
  "email",
  "emergencyContactName",
  "emergencyContactNumber",
  "gender",
  "insurancePolicyNumber",
  "insuranceProvider",
  "name",
  "occupation",
  "phone",
  "primaryPhysician",
  "privacyConsent",
  "treatmentConsent",
];

const OPTIONAL = [
  "allergies",
  "currentMedication",
  "familyMedicalHistory",
  "identificationDocument",
  "identificationNumber",
  "identificationType",
  "pastMedicalHistory",
];

describe("isRequiredField", () => {
  it("agrees with the pinned required list", () => {
    const actual = Object.keys(PatientFormValidation.shape)
      .filter((name) => isRequiredField(name as never))
      .toSorted();
    expect(actual).toEqual(REQUIRED);
  });

  it("agrees with the pinned optional list", () => {
    const actual = Object.keys(PatientFormValidation.shape)
      .filter((name) => !isRequiredField(name as never))
      .toSorted();
    expect(actual).toEqual(OPTIONAL);
  });

  it("accounts for all 22 fields", () => {
    expect(REQUIRED.length + OPTIONAL.length).toBe(22);
  });

  it("treats a consent checkbox as required despite being a plain boolean", () => {
    // consentSchema is z.boolean().refine(v => v === true) with no default, so
    // undefined must not parse. This is the case a naive `.isOptional()` check
    // is most likely to get wrong.
    expect(isRequiredField("treatmentConsent")).toBe(true);
  });
});
