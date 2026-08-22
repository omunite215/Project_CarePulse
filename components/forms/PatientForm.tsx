"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import CustomFormField, { FormFieldType } from "@/components/CustomFormField";
import SubmitButton from "@/components/SubmitButton";
import { Form } from "@/components/ui/form";
import { createUser } from "@/lib/actions/patient.actions";
import { applyServerErrors } from "@/lib/forms/apply-server-errors";
import { UserFormValidation, type UserFormValues } from "@/lib/validation/user";

/**
 * Onboarding: name, email, phone.
 *
 * Three things were broken here and all three mattered:
 *  - it validated against the 22-field `PatientFormValidation`, so
 *    `handleSubmit` never reached `onSubmit`;
 *  - `createUser` returned `undefined` on success, so the redirect never fired;
 *  - `setIsLoading(false)` was never called, so the button stayed disabled and
 *    spinning forever after the first click.
 *
 * Submission state now comes from react-hook-form's own `isSubmitting`, which
 * cannot drift out of sync with the promise the way a hand-rolled `useState`
 * did.
 */
export default function PatientForm() {
  const router = useRouter();

  const form = useForm<UserFormValues>({
    resolver: zodResolver(UserFormValidation),
    defaultValues: { name: "", email: "", phone: "" },
  });

  async function onSubmit(values: UserFormValues) {
    const result = await createUser(values);

    if (!result.ok) {
      applyServerErrors(form, result);
      return;
    }

    router.push(`/patients/${result.data.id}/register`);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-6">
        <section className="mb-12 space-y-4">
          <h1 className="header">Hi there 👋</h1>
          <p className="text-foreground/80">Get started with appointments.</p>
        </section>

        <CustomFormField
          fieldType={FormFieldType.INPUT}
          control={form.control}
          name="name"
          label="Full name"
          placeholder="Jane Cooper"
          iconSrc="/assets/icons/user.svg"
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

        <SubmitButton
          isLoading={form.formState.isSubmitting}
          loadingLabel="Getting started…"
        >
          Get started
        </SubmitButton>
      </form>
    </Form>
  );
}
