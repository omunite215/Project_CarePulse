"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { createContext, use, useMemo, type ReactNode } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";

import { useFormDraft, type FormDraft } from "@/components/forms/useFormDraft";
import { Form } from "@/components/ui/form";
import {
  REGISTER_STEP_IDS,
  REGISTER_STEPS,
  stepIndexOf,
  type RegisterStepId,
} from "@/lib/forms/register-steps";
import type { User } from "@/lib/data/types";
import {
  PatientFormDefaultValues,
  PatientFormValidation,
  type PatientFormValues,
} from "@/lib/validation/patient";

interface RegisterWizardValue {
  user: User;
  form: UseFormReturn<PatientFormValues>;
  draft: FormDraft;
  step: RegisterStepId;
  stepIndex: number;
  setStep: (id: RegisterStepId) => void;
}

const RegisterWizardContext = createContext<RegisterWizardValue | null>(null);

export function useRegisterWizard(): RegisterWizardValue {
  const value = use(RegisterWizardContext);
  if (!value) {
    throw new Error(
      "useRegisterWizard must be used within a <RegisterWizardProvider>",
    );
  }
  return value;
}

/**
 * Owns the form so that both `AuthShell` slots can read it.
 *
 * The step indicator renders in the hero track and the fields render in the
 * content column — siblings in the shell's grid, with no prop path between
 * them. Hoisting `useForm` here and rendering react-hook-form's own
 * `FormProvider` (exported as `Form`) is what lets the indicator derive
 * per-step completeness from the same form state the fields write to.
 */
export function RegisterWizardProvider({
  user,
  children,
}: {
  user: User;
  children: ReactNode;
}) {
  const form = useForm<PatientFormValues>({
    resolver: zodResolver(PatientFormValidation),
    /*
     * Validate on first blur, then live once the field has been touched. Pure
     * `onBlur` leaves a corrected field showing a stale error until the next
     * blur; `onChange` scolds you halfway through typing an email address.
     */
    mode: "onTouched",
    defaultValues: {
      ...PatientFormDefaultValues,
      name: user.name,
      email: user.email,
      phone: user.phone,
    },
  });

  // 22 fields is a lot to lose to a stray refresh.
  const draft = useFormDraft(form, `register:${user.id}`);

  /*
   * The step is URL state, not React state, so browser back returns to the
   * previous step instead of leaving the form, and a reload resumes where you
   * were. `history: "push"` is the deliberate difference from the admin
   * filters, which use "replace" — there, every keystroke would bury the
   * previous page; here, each step genuinely is somewhere you navigated to.
   */
  const [step, setRawStep] = useQueryState(
    "step",
    // REGISTER_STEPS is non-empty by construction (it lists all four wizard
    // steps); the `!` only silences `noUncheckedIndexedAccess`, which cannot
    // see that guarantee through the array's type.
    parseAsStringLiteral(REGISTER_STEP_IDS).withDefault(REGISTER_STEPS[0]!.id),
  );

  const value = useMemo<RegisterWizardValue>(
    () => ({
      user,
      form,
      draft,
      step,
      stepIndex: stepIndexOf(step),
      setStep: (id) => {
        void setRawStep(id, { history: "push" });
        // A new step starts at the top; otherwise a short step inherits the
        // scroll position of a long one and opens part-way down.
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
    }),
    [user, form, draft, step, setRawStep],
  );

  return (
    <RegisterWizardContext.Provider value={value}>
      <Form {...form}>{children}</Form>
    </RegisterWizardContext.Provider>
  );
}
