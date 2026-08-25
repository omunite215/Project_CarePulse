"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { FieldErrors } from "react-hook-form";

import CustomFormField, { FormFieldType } from "@/components/CustomFormField";
import { FileUploader } from "@/components/FileUploader";
import SubmitButton from "@/components/SubmitButton";
import { FieldRequirements } from "@/components/forms/FieldRequirements";
import { FormErrorSummary } from "@/components/forms/FormErrorSummary";
import { RegisterReview } from "@/components/forms/RegisterReview";
import { RegisterStepProgress } from "@/components/forms/RegisterStepIndicator";
import { useRegisterWizard } from "@/components/forms/RegisterWizardProvider";
import { FormDraftNotice } from "@/components/forms/useFormDraft";
import { Button } from "@/components/ui/button";
import { FormControl } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SelectItem } from "@/components/ui/select";
import {
  Doctors,
  GenderLabels,
  GenderOptions,
  IdentificationTypes,
} from "@/constants";
import { registerPatient } from "@/lib/actions/patient.actions";
import { applyServerErrors, toastSuccess } from "@/lib/forms/apply-server-errors";
import { REGISTER_STEPS, stepOwningField } from "@/lib/forms/register-steps";
import {
  PatientFormValidation,
  type PatientFormValues,
} from "@/lib/validation/patient";

/**
 * Full patient registration: four sections, 22 fields.
 *
 * What was here before was a byte-for-byte copy of `PatientForm` — three fields,
 * validated against this 22-field schema, so it could never submit.
 *
 * The payload goes over as FormData because of the file. Everything else is one
 * JSON blob under `payload`, which keeps a single Zod schema in charge of
 * validation on both sides instead of hand-parsing 22 FormData entries.
 *
 * One step renders at a time (this is a wizard, not a 22-field scroll): each
 * section below is conditional on `step`, not CSS-hidden, because a
 * hidden-but-mounted field is still tabbable and still submits.
 */
export default function RegisterForm() {
  const router = useRouter();
  const { user, form, draft, step, stepIndex, setStep } = useRegisterWizard();

  const selectedPhysician = form.watch("primaryPhysician");

  const current = REGISTER_STEPS[stepIndex];
  const next = REGISTER_STEPS[stepIndex + 1];
  const previous = REGISTER_STEPS[stepIndex - 1];

  // Derived from `next`, not from an index comparison: the compiler already
  // narrows on it, so the two can never disagree.
  const isLast = !next;

  async function goNext() {
    if (!current || !next) return;
    // Validate only this step's fields. Validating the whole schema here would
    // show step 3's errors while the user is still on step 1.
    const valid = await form.trigger([...current.fields]);
    if (!valid) return;
    setStep(next.id);
  }

  function skipStep() {
    // Only offered on a step where every field is optional, so there is nothing
    // to clear and nothing to validate.
    if (!next) return;
    setStep(next.id);
  }

  const formRef = useRef<HTMLFormElement>(null);

  // Steps 1-3 have no submit button, so a form with more than one text field
  // and no submit button falls under the HTML implicit-submission rule: Enter
  // is simply ignored there. Route it to the same action as "Continue" —
  // but only for the plain text-style inputs the rule is actually about, so a
  // <textarea>'s newline and a button's (select trigger, date picker, radio
  // item) own Enter handling are left alone.
  //
  // Wired via a native listener rather than a JSX `onKeyDown`: a <form> has
  // no interactive ARIA role, so an `onKeyDown` prop there is a
  // non-interactive-element-interaction lint error, even though listening
  // for Enter is exactly the browser's own submission model for this
  // element.
  //
  // Deliberately no dependency array: `goNext` and `isLast` are rebuilt every
  // render, so `[]` would pin them to the first step's values — Enter on step 2
  // would validate step 1's fields and navigate to itself. Re-attaching one
  // listener on one node is cheaper than that class of bug.
  useEffect(() => {
    const formElement = formRef.current;
    if (!formElement) return;

    function handleEnterKey(event: KeyboardEvent) {
      if (event.key !== "Enter") return;
      // Committing a CJK input-method candidate fires Enter with
      // isComposing set. Advancing here would unmount the field mid-composition
      // and throw away what the user was still typing.
      if (event.isComposing) return;
      // The last step already has a SubmitButton; let the browser's native
      // implicit submission behaviour handle Enter there.
      if (isLast) return;
      if (!(event.target instanceof HTMLInputElement)) return;
      if (event.target.type === "file") return;

      event.preventDefault();
      void goNext();
    }

    formElement.addEventListener("keydown", handleEnterKey);
    return () => formElement.removeEventListener("keydown", handleEnterKey);
  });

  // Only the current step's <section> is mounted (see the note on the
  // component doc comment above), so an error on a field outside it has no
  // <FormMessage> to render and no input ref for react-hook-form's
  // shouldFocusError to land on. Without this, a stray invalid field left
  // behind on an earlier step made "Complete registration" look inert: no
  // navigation, no visible error, nothing.
  function onInvalid(errors: FieldErrors<PatientFormValues>) {
    const erroredSteps = new Set(
      (Object.keys(errors) as (keyof PatientFormValues)[])
        // A cross-field `.refine` on the schema emits an issue with an empty
        // path, which zodResolver keys as "" — and `stepOwningField` throws on
        // a key no step owns. Filtering to real schema fields keeps a future
        // schema change from re-arming the inert-submit dead end this function
        // exists to remove.
        .filter((key) => key in PatientFormValidation.shape)
        .map(stepOwningField),
    );

    // Walk in wizard order, not Object.keys(errors) order (which is not
    // guaranteed to match it), so a step-1 problem always wins over a later
    // one instead of bouncing the user to whichever error happened to sort
    // first.
    const target = REGISTER_STEPS.find((candidate) =>
      erroredSteps.has(candidate),
    );

    // The error is already on screen if it belongs to the current step —
    // navigating (and the scroll-to-top that comes with it) would just be
    // noise.
    if (target && target.id !== current?.id) setStep(target.id);
  }

  async function onSubmit(values: PatientFormValues) {
    // The Date and the File both survive Next's Server Action serialiser, so no
    // manual FormData packing or JSON round-trip is needed.
    const { identificationDocument, ...rest } = values;

    const result = await registerPatient(
      user.id,
      rest,
      identificationDocument?.[0] ?? null,
    );

    if (!result.ok) {
      applyServerErrors(form, result);

      // A server field error can land on a step the user is no longer on —
      // the Appwrite adapter's duplicate-phone error targets `phone`, which
      // lives on step 1 while this submit happens on step 4. Without this the
      // form would reject the submission with nothing visible on screen.
      // Wizard order, and filtered to real schema fields. `applyServerErrors`
      // casts each key with `name as Path<T>` without checking it, so a server
      // returning an unexpected key would otherwise reach `stepOwningField`,
      // which throws. This mirrors the guard already in `onInvalid` — the two
      // paths are different (this one runs *after* client validation passed)
      // but they must not disagree about where to send the user.
      const serverFields = new Set(Object.keys(result.error.fieldErrors ?? {}));
      const target = REGISTER_STEPS.find((candidate) =>
        candidate.fields.some((field) => serverFields.has(field)),
      );
      if (target && target.id !== step) setStep(target.id);
      return;
    }

    draft.clear();
    toastSuccess("Registration complete.");
    router.push(`/patients/${user.id}/new-appointment`);
  }

  return (
    <FieldRequirements schema={PatientFormValidation}>
      {/* One wrapper for all 22 fields rather than a `required` prop repeated
          at every call site. Scoped to this form's own schema so a field name
          this form shares with another form (there are none today, but the
          derivation is schema-based precisely so that could change safely) is
          judged by *this* validation, not a name collision. */}
      <form
        ref={formRef}
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        className="flex-1 space-y-12"
      >
        <section className="space-y-4">
          <h1 className="header">Welcome 👋</h1>
          <p className="text-foreground/80">
            Let us know more about yourself so we can prepare for your visit.
          </p>
          <p className="text-12-regular text-muted-foreground">
            <span aria-hidden="true">*</span> indicates a required field.
          </p>
          <FormDraftNotice draft={draft} />
          <RegisterStepProgress />
        </section>

        {/* ---------------------------- Personal ---------------------------- */}
        {step === "personal" ? (
          <section className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
            <h2 className="sub-header col-span-full text-foreground">
              Personal information
            </h2>

            <CustomFormField
              fieldType={FormFieldType.INPUT}
              control={form.control}
              name="name"
              label="Full name"
              placeholder="Jane Cooper"
              iconSrc="/assets/icons/user.svg"
              className="col-span-full"
            />

            <CustomFormField
              fieldType={FormFieldType.INPUT}
              control={form.control}
              name="email"
              label="Email"
              type="email"
              inputMode="email"
              placeholder="jane@example.com"
              iconSrc="/assets/icons/email.svg"
            />
            <CustomFormField
              fieldType={FormFieldType.PHONE_INPUT}
              control={form.control}
              name="phone"
              label="Phone number"
              placeholder="(555) 123-4567"
            />
            <CustomFormField
              fieldType={FormFieldType.DATE_PICKER}
              control={form.control}
              name="birthDate"
              label="Date of birth"
              placeholder="Select your date of birth"
              variant="birthdate"
              /* An explicit floor: DayPicker's dropdown default is 100 years,
                 which excludes living centenarians. */
              fromDate={new Date(new Date().getFullYear() - 120, 0, 1)}
              toDate={new Date()}
            />

            <CustomFormField
              fieldType={FormFieldType.SKELETON}
              control={form.control}
              name="gender"
              label="Gender"
              renderSkeleton={(field) => (
                <FormControl>
                  {/* grid, not flex: equal cells hold their width instead of
                      shrinking to their label text at narrow viewports. Two
                      columns below `lg`: at 768px the content track is 512px
                      (768 minus the 256px shell image track), minus a 48px
                      page-shell gutter, split across two `gap-6` section
                      columns — this field's cell is ~220px, not ~356px. Three
                      equal columns would give "Female" ~65px of cell for
                      ~127px of content (radio + gap + label) and it would
                      overflow into "Other". Two columns give ~104px each —
                      comfortable — and the third option wraps to a second row.
                      Three-up returns at `lg`, where there is room again. */}
                  <RadioGroup
                    className="grid grid-cols-2 gap-3 lg:grid-cols-3"
                    onValueChange={field.onChange}
                    value={String(field.value ?? "")}
                  >
                    {GenderOptions.map((option) => (
                      <div key={option} className="radio-group">
                        <RadioGroupItem value={option} id={option} />
                        <label
                          htmlFor={option}
                          className="cursor-pointer text-sm font-medium text-foreground"
                        >
                          {GenderLabels[option]}
                        </label>
                      </div>
                    ))}
                  </RadioGroup>
                </FormControl>
              )}
            />

            <CustomFormField
              fieldType={FormFieldType.INPUT}
              control={form.control}
              name="address"
              label="Address"
              placeholder="418 Maple Street, Springfield, IL"
            />
            <CustomFormField
              fieldType={FormFieldType.INPUT}
              control={form.control}
              name="occupation"
              label="Occupation"
              placeholder="Software Engineer"
              description="We ask because some conditions are work-related."
            />
            <CustomFormField
              fieldType={FormFieldType.INPUT}
              control={form.control}
              name="emergencyContactName"
              label="Emergency contact name"
              placeholder="Next of kin"
              description="Someone we can call if we cannot reach you."
            />
            <CustomFormField
              fieldType={FormFieldType.PHONE_INPUT}
              control={form.control}
              name="emergencyContactNumber"
              label="Emergency contact number"
              placeholder="(555) 987-6543"
            />
          </section>
        ) : null}

        {/* ---------------------------- Medical ----------------------------- */}
        {step === "medical" ? (
          <section className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
            <h2 className="sub-header col-span-full text-foreground">
              Medical information
            </h2>

            {/* Full row until `2xl`: this is the Medical section's primary
                field, and its dropdown items render doctor avatars that need
                more room than a plain select — unlike `identificationType`
                below, which stays a normal grid cell. */}
            <CustomFormField
              fieldType={FormFieldType.SELECT}
              control={form.control}
              name="primaryPhysician"
              label="Primary care physician"
              placeholder="Select a doctor"
              className="col-span-full 2xl:col-span-1"
            >
              {Doctors.map((doctor) => (
                <SelectItem
                  key={doctor.name}
                  value={doctor.name}
                  className="shad-combobox-item"
                >
                  <span className="flex cursor-pointer items-center gap-2">
                    <Image
                      src={doctor.image}
                      width={32}
                      height={32}
                      alt=""
                      aria-hidden="true"
                      className="rounded-full border border-border"
                    />
                    Dr. {doctor.name}
                  </span>
                </SelectItem>
              ))}
            </CustomFormField>

            <CustomFormField
              fieldType={FormFieldType.INPUT}
              control={form.control}
              name="insuranceProvider"
              label="Insurance provider"
              placeholder="Blue Shield"
            />
            <CustomFormField
              fieldType={FormFieldType.INPUT}
              control={form.control}
              name="insurancePolicyNumber"
              label="Insurance policy number"
              placeholder="ABC1234567"
            />

            <CustomFormField
              fieldType={FormFieldType.TEXTAREA}
              control={form.control}
              name="allergies"
              label="Allergies (if any)"
              placeholder="Peanuts, penicillin, pollen"
              className="md:col-span-2"
              maxLength={500}
              description="Include medicines, foods and anything else you react to. Leave blank if none. Up to 500 characters."
            />
            <CustomFormField
              fieldType={FormFieldType.TEXTAREA}
              control={form.control}
              name="currentMedication"
              label="Current medication (if any)"
              placeholder="Ibuprofen 200mg, Levothyroxine 50mcg"
              className="md:col-span-2"
              maxLength={500}
              description="Name and dose, if you know it. An approximate list is still useful. Up to 500 characters."
            />
            <CustomFormField
              fieldType={FormFieldType.TEXTAREA}
              control={form.control}
              name="familyMedicalHistory"
              label="Family medical history"
              placeholder="Mother had brain cancer, father has hypertension"
              className="md:col-span-2"
              maxLength={500}
              description="Conditions that run in your family, and who had them. Up to 500 characters."
            />
            <CustomFormField
              fieldType={FormFieldType.TEXTAREA}
              control={form.control}
              name="pastMedicalHistory"
              label="Past medical history"
              placeholder="Appendectomy in 2015, asthma diagnosis in childhood"
              className="md:col-span-2"
              maxLength={500}
              description="Past operations, hospital stays or long-term conditions. Up to 500 characters."
            />
          </section>
        ) : null}

        {/* ------------------------- Identification ------------------------- */}
        {step === "identification" ? (
          <section className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
            <h2 className="sub-header col-span-full text-foreground">
              Identification and verification
            </h2>

            <p className="text-12-regular col-span-full text-muted-foreground">
              Every field on this step is optional. You can register without an
              ID document — the clinic may ask for it at your visit.
            </p>

            <CustomFormField
              fieldType={FormFieldType.SELECT}
              control={form.control}
              name="identificationType"
              label="Identification type"
              placeholder="Select an identification type"
            >
              {IdentificationTypes.map((type) => (
                <SelectItem key={type} value={type} className="shad-combobox-item">
                  {type}
                </SelectItem>
              ))}
            </CustomFormField>

            <CustomFormField
              fieldType={FormFieldType.INPUT}
              control={form.control}
              name="identificationNumber"
              label="Identification number"
              placeholder="123456789"
            />

            <CustomFormField
              fieldType={FormFieldType.SKELETON}
              control={form.control}
              name="identificationDocument"
              label="Scanned copy of identification document"
              className="col-span-full"
              renderSkeleton={(field) => (
                <FormControl>
                  <FileUploader
                    files={field.value as File[] | undefined}
                    onChange={field.onChange}
                  />
                </FormControl>
              )}
            />
          </section>
        ) : null}

        {/* ------------------------- Review and consent ---------------------- */}
        {step === "review" ? (
          <>
            <RegisterReview />

            {/* Distinguishing border/tint so this reads as the action — the
                thing you actually do on this step — rather than a fourth
                summary card sitting alongside the ones above it. */}
            <section className="space-y-6 rounded-xl border border-green-500 bg-green-500/5 p-4">
              <h2 className="sub-header text-foreground">Consent and privacy</h2>

              <CustomFormField
                fieldType={FormFieldType.CHECKBOX}
                control={form.control}
                name="treatmentConsent"
                checkboxLabel="I consent to receive treatment for my health condition."
              />
              <CustomFormField
                fieldType={FormFieldType.CHECKBOX}
                control={form.control}
                name="disclosureConsent"
                checkboxLabel="I consent to the use and disclosure of my health information for treatment purposes."
              />
              <CustomFormField
                fieldType={FormFieldType.CHECKBOX}
                control={form.control}
                name="privacyConsent"
                checkboxLabel="I acknowledge that I have reviewed and agree to the privacy policy."
              />
            </section>
          </>
        ) : null}

        <FormErrorSummary />

        {/* ------------------------- Navigation footer ------------------------ */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          {previous ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(previous.id)}
            >
              Back
            </Button>
          ) : (
            <span />
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            {current?.optional && !isLast ? (
              <Button type="button" variant="ghost" onClick={skipStep}>
                Skip this step
              </Button>
            ) : null}

            {isLast ? (
              <SubmitButton
                isLoading={form.formState.isSubmitting}
                loadingLabel="Submitting…"
              >
                Complete registration
              </SubmitButton>
            ) : (
              <Button type="button" onClick={goNext} className="shad-primary-btn">
                {/* The doctor's name only means something once one is chosen. */}
                {current?.id === "medical" && selectedPhysician
                  ? `Continue with Dr. ${selectedPhysician}`
                  : "Continue"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </FieldRequirements>
  );
}
