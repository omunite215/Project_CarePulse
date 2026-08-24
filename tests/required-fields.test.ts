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
      .filter((name) => isRequiredField(PatientFormValidation, name))
      .toSorted();
    expect(actual).toEqual(REQUIRED);
  });

  it("agrees with the pinned optional list", () => {
    const actual = Object.keys(PatientFormValidation.shape)
      .filter((name) => !isRequiredField(PatientFormValidation, name))
      .toSorted();
    expect(actual).toEqual(OPTIONAL);
  });

  it("accounts for every field in the schema", () => {
    // The pinned lists above are only meaningful if they describe the whole
    // schema. Comparing them to each other proves nothing; comparing their
    // union to the schema's own keys is what catches a field being added or
    // removed without anyone revisiting the asterisks.
    expect([...REQUIRED, ...OPTIONAL].toSorted()).toEqual(
      Object.keys(PatientFormValidation.shape).toSorted(),
    );
  });

  it("treats a consent checkbox as required despite being a plain boolean", () => {
    // consentSchema is z.boolean().refine(v => v === true) with no default, so
    // undefined must not parse. This is the case a naive `.isOptional()` check
    // is most likely to get wrong.
    expect(isRequiredField(PatientFormValidation, "treatmentConsent")).toBe(true);
  });

  it("returns false for a name that is not a key of the given schema", () => {
    // The mechanism that keeps one form's schema from answering for another
    // form's field of the same name: an unknown key is just absent, not an
    // error, and absent reads as optional.
    expect(isRequiredField(PatientFormValidation, "notARealField")).toBe(false);
  });
});
