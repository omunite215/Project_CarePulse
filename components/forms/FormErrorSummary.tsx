"use client";

import { useEffect, useId, useRef } from "react";

import { useRegisterWizard } from "@/components/forms/RegisterWizardProvider";
import { REGISTER_STEPS, stepOwningField } from "@/lib/forms/register-steps";
import type { PatientFormValues } from "@/lib/validation/patient";

/**
 * Lists everything wrong after a failed submit and routes to each field.
 *
 * Each entry is a button, not an anchor. Fields on other steps are not in the
 * DOM, so a fragment link has nothing to target — it has to switch step first
 * and focus afterwards.
 *
 * `role="alert"` lives on an inner wrapper around the heading and list, not
 * on the outer container that receives focus. GOV.UK's error summary is the
 * source of this pattern, and it keeps `role="alert"` — it moved the role off
 * the focused container onto a nested child specifically to fix a JAWS race
 * condition where the live-region announcement and the focus-move
 * announcement, firing at the same moment, caused one of the two to be
 * dropped (alphagov/govuk-frontend#2677). It did not remove the live region.
 * Splitting the two here the same way keeps both announcements: focus lands
 * on the outer `<div>`, named by `aria-labelledby` from its own heading, and
 * the nested `role="alert"` separately announces the itemised list of what
 * is wrong — content a focus move alone would never read out. For a
 * patient-facing medical form, that redundancy is the right trade.
 */
export function FormErrorSummary() {
  const { form, setStep, step } = useRegisterWizard();
  const errors = form.formState.errors;
  const ref = useRef<HTMLDivElement>(null);
  const headingId = useId();

  // Set by `goToField` when the target field's step is not the current one;
  // cleared once that step has actually rendered (see the effect below).
  const pendingFocus = useRef<keyof PatientFormValues | null>(null);

  // The submitCount already focused, so the effect below can tell "a new
  // submit just failed" apart from "the user fixed one field while three
  // others are still invalid" — the latter changes `names.length` too, but
  // must not yank focus away from the field they are mid-correction on.
  const focusedForSubmit = useRef(0);

  // Filtered to real schema fields, and ordered by the wizard rather than by
  // `Object.keys`. Built by walking each step's own field list, not
  // `Object.keys(errors)`, so a cross-field `.refine` on the schema — which
  // would emit an issue with an empty path that zodResolver keys as "" — can
  // never appear here: "" is not in any step's field list, so `stepOwningField`
  // (called only from `goToField`, only with names drawn from this list)
  // never receives a key it doesn't own. Wizard order also means the list
  // reads in the order the user filled the form, not in whatever order the
  // resolver happened to report.
  const names = REGISTER_STEPS.flatMap((s) =>
    s.fields.filter((field) => field in errors),
  );

  useEffect(() => {
    const submitCount = form.formState.submitCount;
    if (names.length === 0 || submitCount === focusedForSubmit.current) return;
    focusedForSubmit.current = submitCount;
    ref.current?.focus();
  }, [form.formState.submitCount, names.length]);

  // Focuses the target field once its step has actually mounted, instead of
  // guessing how long a step switch takes. This effect is keyed on `step`
  // itself, so it only runs after React has committed the render that put
  // the new step's section (and the target field) in the DOM — the exact
  // moment `setFocus` needs, no matter whether that commit lands on the next
  // tick or later.
  useEffect(() => {
    const name = pendingFocus.current;
    if (!name || stepOwningField(name).id !== step) return;
    pendingFocus.current = null;
    form.setFocus(name);
  }, [step, form]);

  if (names.length === 0) return null;

  function goToField(name: keyof PatientFormValues) {
    const owner = stepOwningField(name);
    if (owner.id === step) {
      form.setFocus(name);
      return;
    }
    pendingFocus.current = name;
    setStep(owner.id);
  }

  return (
    <div
      ref={ref}
      tabIndex={-1}
      aria-labelledby={headingId}
      className="rounded-md border border-destructive bg-destructive/10 p-4"
    >
      {/* The live region: nested rather than on the parent `<div>` above, per
          the comment on this component. */}
      <div role="alert">
        <h2 id={headingId} className="text-14-medium mb-2 text-destructive">
          {names.length === 1
            ? "One answer needs your attention"
            : `${names.length} answers need your attention`}
        </h2>
        <ul className="space-y-1">
          {names.map((name) => (
            <li key={name}>
              <button
                type="button"
                onClick={() => goToField(name)}
                className="text-14-regular text-destructive underline hover:no-underline"
              >
                {String(errors[name]?.message ?? "This answer is not valid")}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
