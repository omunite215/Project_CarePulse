"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
  /**
   * How many times a submit or a per-step "Continue" has failed validation
   * this session. `FormErrorSummary` shows only once this is greater than
   * zero, rather than whenever any error exists — see `recordFailedAttempt`
   * for why a submit count alone cannot serve as that signal.
   */
  failedAttempts: number;
  /**
   * Call once per failed submit and once per failed `goNext` ("Continue").
   * `form.formState.submitCount` cannot stand in for this on its own: it only
   * increments on an actual submit, so a wizard user who fails "Continue" on
   * step 1 and never reaches the last step's Submit button would never flip
   * a `submitCount`-only gate, even though that is exactly the case
   * `FormErrorSummary` needs to cover. A plain field blur touches neither
   * this nor `submitCount`, which is what keeps the summary from appearing
   * before either has actually been attempted.
   */
  recordFailedAttempt: () => void;
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
    /*
     * react-hook-form's own default (`true`) auto-focuses the first
     * registered field with an error whenever `handleSubmit`'s validation
     * fails — a third, uncoordinated actor fighting the deliberate handoff
     * between the new step's heading and `FormErrorSummary` (see the
     * heading-focus effect in `RegisterForm`). Left on, a failed submit that
     * routes to another step lets this fire *after* that step's fields
     * remount and register, silently overriding both: focus lands on
     * whichever field happens to be first in the DOM, not on the summary.
     * `FormErrorSummary`'s own "jump to field" buttons already call
     * `form.setFocus` deliberately, and `applyServerErrors` passes its own
     * `shouldFocus` per field — neither depends on this default.
     */
    shouldFocusError: false,
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
    parseAsStringLiteral(REGISTER_STEP_IDS).withDefault(REGISTER_STEPS[0].id),
  );

  // See `recordFailedAttempt` on the context type for why this exists
  // alongside (not instead of) `form.formState.submitCount`.
  const [failedAttempts, setFailedAttempts] = useState(0);
  const recordFailedAttempt = useCallback(
    () => setFailedAttempts((count) => count + 1),
    [],
  );

  const value = useMemo<RegisterWizardValue>(
    () => ({
      user,
      form,
      draft,
      step,
      stepIndex: stepIndexOf(step),
      setStep: (id) => {
        // setRawStep relies on nuqs's `shallow` defaulting to `true` to avoid
        // triggering a Server Component round-trip on every step change.
        void setRawStep(id, { history: "push" });
        // A new step starts at the top; otherwise a short step inherits the
        // scroll position of a long one and opens part-way down.
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
      failedAttempts,
      recordFailedAttempt,
    }),
    [user, form, draft, step, setRawStep, failedAttempts, recordFailedAttempt],
  );

  return (
    <RegisterWizardContext.Provider value={value}>
      <Form {...form}>{children}</Form>
    </RegisterWizardContext.Provider>
  );
}
