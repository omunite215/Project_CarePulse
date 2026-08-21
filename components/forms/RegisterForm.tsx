"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import CustomFormField, { FormFieldType } from "@/components/CustomFormField";
import { FileUploader } from "@/components/FileUploader";
import SubmitButton from "@/components/SubmitButton";
import { FormDraftNotice, useFormDraft } from "@/components/forms/useFormDraft";
import { Form, FormControl } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SelectItem } from "@/components/ui/select";
import {
  Doctors,
  GenderLabels,
  GenderOptions,
  IdentificationTypes,
} from "@/constants";
import { registerPatient } from "@/lib/actions/patient.actions";
import type { User } from "@/lib/data/types";
import { applyServerErrors, toastSuccess } from "@/lib/forms/apply-server-errors";
import {
  PatientFormDefaultValues,
  PatientFormValidation,
  type PatientFormValues,
} from "@/lib/validation/patient";

/**
 * Full patient registration: four sections, 23 fields.
 *
 * What was here before was a byte-for-byte copy of `PatientForm` — three fields,
 * validated against this 23-field schema, so it could never submit.
 *
 * The payload goes over as FormData because of the file. Everything else is one
 * JSON blob under `payload`, which keeps a single Zod schema in charge of
 * validation on both sides instead of hand-parsing 22 FormData entries.
 */
export default function RegisterForm({ user }: { user: User }) {
  const router = useRouter();

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(PatientFormValidation),
    defaultValues: {
      ...PatientFormDefaultValues,
      name: user.name,
      email: user.email,
      phone: user.phone,
    },
  });

  // 23 fields is a lot to lose to a stray refresh.
  const draft = useFormDraft(form, `register:${user.id}`);

  const selectedPhysician = form.watch("primaryPhysician");

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
      return;
    }

    draft.clear();
    toastSuccess("Registration complete.");
    router.push(`/patients/${user.id}/new-appointment`);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-12">
        <section className="space-y-4">
          <h1 className="header">Welcome 👋</h1>
          <p className="text-foreground/80">
            Let us know more about yourself so we can prepare for your visit.
          </p>
          <FormDraftNotice draft={draft} />
        </section>

        {/* ---------------------------- Personal ---------------------------- */}
        <section className="space-y-6">
          <h2 className="sub-header text-foreground">Personal information</h2>

          <CustomFormField
            fieldType={FormFieldType.INPUT}
            control={form.control}
            name="name"
            label="Full name"
            placeholder="Jane Cooper"
            iconSrc="/assets/icons/user.svg"
          />

          <div className="flex flex-col gap-6 xl:flex-row">
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
          </div>

          <div className="flex flex-col gap-6 xl:flex-row">
            <CustomFormField
              fieldType={FormFieldType.DATE_PICKER}
              control={form.control}
              name="birthDate"
              label="Date of birth"
              placeholder="Select your date of birth"
              toDate={new Date()}
            />

            <CustomFormField
              fieldType={FormFieldType.SKELETON}
              control={form.control}
              name="gender"
              label="Gender"
              renderSkeleton={(field) => (
                <FormControl>
                  <RadioGroup
                    className="flex h-11 gap-6 xl:justify-between"
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
          </div>

          <div className="flex flex-col gap-6 xl:flex-row">
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
            />
          </div>

          <div className="flex flex-col gap-6 xl:flex-row">
            <CustomFormField
              fieldType={FormFieldType.INPUT}
              control={form.control}
              name="emergencyContactName"
              label="Emergency contact name"
              placeholder="Next of kin"
            />
            <CustomFormField
              fieldType={FormFieldType.PHONE_INPUT}
              control={form.control}
              name="emergencyContactNumber"
              label="Emergency contact number"
              placeholder="(555) 987-6543"
            />
          </div>
        </section>

        {/* ---------------------------- Medical ----------------------------- */}
        <section className="space-y-6">
          <h2 className="sub-header text-foreground">Medical information</h2>

          <CustomFormField
            fieldType={FormFieldType.SELECT}
            control={form.control}
            name="primaryPhysician"
            label="Primary care physician"
            placeholder="Select a doctor"
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

          <div className="flex flex-col gap-6 xl:flex-row">
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
          </div>

          <div className="flex flex-col gap-6 xl:flex-row">
            <CustomFormField
              fieldType={FormFieldType.TEXTAREA}
              control={form.control}
              name="allergies"
              label="Allergies (if any)"
              placeholder="Peanuts, penicillin, pollen"
            />
            <CustomFormField
              fieldType={FormFieldType.TEXTAREA}
              control={form.control}
              name="currentMedication"
              label="Current medication (if any)"
              placeholder="Ibuprofen 200mg, Levothyroxine 50mcg"
            />
          </div>

          <div className="flex flex-col gap-6 xl:flex-row">
            <CustomFormField
              fieldType={FormFieldType.TEXTAREA}
              control={form.control}
              name="familyMedicalHistory"
              label="Family medical history"
              placeholder="Mother had brain cancer, father has hypertension"
            />
            <CustomFormField
              fieldType={FormFieldType.TEXTAREA}
              control={form.control}
              name="pastMedicalHistory"
              label="Past medical history"
              placeholder="Appendectomy in 2015, asthma diagnosis in childhood"
            />
          </div>
        </section>

        {/* ------------------------- Identification ------------------------- */}
        <section className="space-y-6">
          <h2 className="sub-header text-foreground">
            Identification and verification
          </h2>

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

        {/* ----------------------------- Consent ---------------------------- */}
        <section className="space-y-6">
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

        <SubmitButton
          isLoading={form.formState.isSubmitting}
          loadingLabel="Submitting…"
        >
          {selectedPhysician
            ? `Continue with Dr. ${selectedPhysician}`
            : "Submit and continue"}
        </SubmitButton>
      </form>
    </Form>
  );
}
