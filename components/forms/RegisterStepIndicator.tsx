"use client";

import { CheckIcon } from "lucide-react";

import { useRegisterWizard } from "@/components/forms/RegisterWizardProvider";
import { REGISTER_STEPS } from "@/lib/forms/register-steps";
import { cn } from "@/lib/utils";

/**
 * Vertical stepper for the hero track.
 *
 * The panel supplies its own background rather than relying on the photo being
 * dark behind the text: the hero is `object-cover`, so the crop moves with
 * viewport height and the image's bright element slides around.
 */
export function RegisterStepIndicator() {
  const { stepIndex } = useRegisterWizard();

  return (
    <nav
      aria-label="Registration progress"
      className="w-full rounded-xl border border-white/10 bg-dark-300/80 p-5 backdrop-blur-md"
    >
      <p className="text-12-regular mb-4 font-bold uppercase tracking-wider text-dark-600">
        Your registration
      </p>

      <ol className="flex flex-col gap-5">
        {REGISTER_STEPS.map((step, index) => {
          const done = index < stepIndex;
          const current = index === stepIndex;

          return (
            <li
              key={step.id}
              // aria-current is the standard mechanism for flagging the
              // active item in an ordered set of steps — screen readers
              // announce it natively, applying it only to the current <li>
              // does not turn the list into a wall of per-item state, and
              // unlike an sr-only text node it does not add an extra word to
              // this item's accessible name.
              aria-current={current ? "step" : undefined}
              className="flex items-start gap-3"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "text-12-regular flex size-6 shrink-0 items-center justify-center rounded-full border font-bold",
                  done || current
                    ? "border-green-500 bg-green-500 text-white"
                    : "border-dark-500 text-dark-600",
                  current && "ring-4 ring-green-500/20",
                )}
              >
                {done ? (
                  <CheckIcon data-slot="step-done-icon" className="size-3.5" />
                ) : (
                  index + 1
                )}
              </span>

              <span className="min-w-0">
                <span
                  className={cn(
                    "text-14-medium block",
                    done || current ? "text-light-200" : "text-dark-600",
                  )}
                >
                  {step.title}
                </span>
                {step.hint ? (
                  <span className="text-12-regular block text-dark-600">
                    {step.hint}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Compact form for viewports below `md`, where the hero track is absent. */
export function RegisterStepProgress() {
  const { stepIndex } = useRegisterWizard();
  // `| undefined` under noUncheckedIndexedAccess — REGISTER_STEPS is a
  // non-empty tuple, so only [0] is guaranteed. Render nothing rather than
  // reaching for a non-null assertion; a previous task's assertion was
  // deliberately removed and must not come back.
  const current = REGISTER_STEPS[stepIndex];
  if (!current) return null;

  return (
    <div className="md:hidden">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-14-medium text-foreground">{current.title}</span>
        <span className="text-12-regular text-muted-foreground">
          Step {stepIndex + 1} of {REGISTER_STEPS.length}
        </span>
      </div>
      {/* Segments, not a single continuous fill, so the native `<progress>`
          element the linter suggests cannot render this — same class of
          exception as ThemeToggle's `role="radio"` and DateField's
          `role="group"` in .oxlintrc.json. */}
      <div
        role="progressbar"
        aria-valuenow={stepIndex + 1}
        aria-valuemin={1}
        aria-valuemax={REGISTER_STEPS.length}
        aria-label="Registration progress"
        className="flex gap-1.5"
      >
        {REGISTER_STEPS.map((step, index) => (
          <span
            key={step.id}
            className={cn(
              "h-1 flex-1 rounded-full",
              index <= stepIndex ? "bg-green-500" : "bg-border",
            )}
          />
        ))}
      </div>
    </div>
  );
}
