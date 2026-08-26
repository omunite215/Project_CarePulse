import { Skeleton } from "@/components/ui/skeleton";
import { APPOINTMENTS_PAGE_SIZE } from "@/constants";
import { REGISTER_STEPS } from "@/lib/forms/register-steps";

/**
 * Skeleton set.
 *
 * Each mirrors the shape of what it replaces, so the swap to real content does
 * not shift the layout. The wrappers carry `aria-busy` and a visually-hidden
 * status line, because a screen reader gets nothing useful from a pile of empty
 * divs.
 */

function Busy({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  // `w-full` so the wrapper stays layout-transparent. `admin-main` is
  // `flex flex-col items-center`, where a child with no width shrink-to-fits —
  // which collapsed StatCardsSkeleton to the width of its own grid gaps and
  // sized DataTableSkeleton to the sum of its placeholder bars instead of to
  // the table. A no-op in ordinary block flow, where this is already 100%.
  return (
    <div aria-busy="true" aria-live="polite" className="w-full">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** One labelled input. */
export function FieldSkeleton({
  className,
  withDescription = false,
}: {
  className?: string;
  /** Mirrors a field that renders a `<FormDescription>` beneath the control
   *  (e.g. Occupation, Emergency contact name) — those rows are measurably
   *  taller, and since a CSS grid row stretches every cell in it to match its
   *  tallest sibling, the field sharing that row inherits the extra height
   *  too. */
  withDescription?: boolean;
}) {
  return (
    <div className={className}>
      <Skeleton className="mb-2 h-4 w-24" />
      <Skeleton className="h-11 w-full" />
      {withDescription ? <Skeleton className="mt-2 h-3 w-48" /> : null}
    </div>
  );
}

export function FormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <Busy label="Loading form">
      <div className="space-y-6">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-5 w-64" />
        <div className="space-y-5 pt-6">
          {Array.from({ length: fields }, (_, i) => (
            <FieldSkeleton key={i} />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    </Busy>
  );
}

/**
 * Matches `RegisterForm`'s first step ("Personal information"), not the old
 * pre-wizard 22-field scroll this replaced: the real page now gates one step
 * of at most nine fields behind a navigation footer, and a skeleton three
 * sections deep would be roughly three times too tall.
 *
 * Every size below was read off the real rendered step (desktop viewport,
 * `pnpm build && pnpm start`) rather than guessed, and every class is the
 * same on-scale Tailwind utility the real markup uses — the section's own
 * `grid gap-6 md:grid-cols-2 2xl:grid-cols-3` and `col-span-full`, `Input`'s
 * `h-11`, `.radio-group`'s content height — not new arbitrary values.
 */
export function RegisterFormSkeleton() {
  return (
    <Busy label="Loading registration form">
      <div className="space-y-12">
        <div className="space-y-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-40" />

          {/* RegisterStepProgress's compact mobile bar, hidden at `md` and up
              exactly like the real one. */}
          <div className="space-y-2 pt-2 md:hidden">
            <div className="flex items-baseline justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-1 flex-1 rounded-full" />
              ))}
            </div>
          </div>
        </div>

        <section className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
          <Skeleton className="col-span-full h-7 w-52" />

          <FieldSkeleton className="col-span-full" /> {/* Full name */}
          <FieldSkeleton /> {/* Email */}
          <FieldSkeleton /> {/* Phone number */}
          <FieldSkeleton /> {/* Date of birth */}

          {/* Gender: a radio group, not a plain input — mirrors
              `.radio-group`'s own three-cell shape rather than reusing
              FieldSkeleton's single-input one. */}
          <div>
            <Skeleton className="mb-2 h-4 w-16" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-11" />
              ))}
            </div>
          </div>

          <FieldSkeleton /> {/* Address */}
          <FieldSkeleton withDescription /> {/* Occupation */}
          <FieldSkeleton withDescription /> {/* Emergency contact name */}
          <FieldSkeleton /> {/* Emergency contact number */}
        </section>

        {/* Navigation footer: no "Back" on step 1, "Continue" on the right. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <span />
          <Skeleton className="h-11 w-32" />
        </div>
      </div>
    </Busy>
  );
}

/**
 * Placeholder for `RegisterStepIndicator`, the vertical stepper rendered over
 * the hero image. It reads `useRegisterWizard()`, whose provider does not
 * exist yet at this point in the tree — `Loading()` renders before the page
 * (and the wizard) mounts — so this mirrors its static footprint instead of
 * rendering the real thing with placeholder data.
 *
 * `aria-hidden`: purely decorative during the loading state. The one
 * meaningful "loading" announcement is `RegisterFormSkeleton`'s own
 * `aria-busy`/`aria-live` region; a second live region here would only
 * repeat it.
 *
 * Step count and which step carries a hint are read off `REGISTER_STEPS`
 * rather than hardcoded, so this stays in sync with the wizard automatically.
 */
export function RegisterStepIndicatorSkeleton() {
  return (
    <nav
      aria-hidden="true"
      className="w-full rounded-xl border border-white/10 bg-dark-300/80 p-5 backdrop-blur-md"
    >
      <Skeleton className="mb-4 h-3 w-32 bg-dark-500/60" />
      <div className="flex flex-col gap-5">
        {REGISTER_STEPS.map((step) => (
          <div key={step.id} className="flex items-start gap-3">
            <Skeleton className="size-6 shrink-0 rounded-full bg-dark-500/60" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-24 bg-dark-500/60" />
              {step.hint ? (
                <Skeleton className="h-3 w-16 bg-dark-500/60" />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}

export function StatCardsSkeleton() {
  return (
    <Busy label="Loading appointment counts">
      <div className="admin-stat">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    </Busy>
  );
}

/**
 * `rows` defaults to the real page size rather than a number someone picked:
 * a skeleton promising eight rows against a table that delivers ten shifted
 * the page by two rows every load, and no test could see it.
 */
export function DataTableSkeleton({
  rows = APPOINTMENTS_PAGE_SIZE,
}: {
  rows?: number;
}) {
  return (
    <Busy label="Loading appointments">
      <div className="data-table">
        {/* The strip above the rows is two different controls: a sort select
            below `md`, where there is no header row to click, and the header
            row itself from `md` up. Both are mirrored here, because a skeleton
            missing either one hands the content a step to jump when it lands —
            and the row parity test only measures rows. `h-11` is what
            `shad-select-trigger` forces; `h-12` is TableHead's own height. */}
        <div
          data-slot="skeleton-sort-bar"
          className="border-b border-border p-4 md:hidden"
        >
          <Skeleton className="h-11 w-full" />
        </div>
        <Skeleton
          data-slot="skeleton-header-bar"
          className="hidden h-12 w-full rounded-none md:block"
        />
        <div className="divide-y divide-border">
          {Array.from({ length: rows }, (_, i) => (
            // `data-slot`, the convention this file's own `Skeleton` primitive
            // already uses, so tests/skeletons.spec.ts can measure a row
            // without depending on the class names that describe its layout.
            <div key={i} data-slot="skeleton-row" className="p-4">
              {/* Card shape below md, row shape from md up — the skeleton has
                  to switch with the content or it reintroduces the shift.
                  Both branches mirror their real counterpart element for
                  element (AppointmentRowCard and columns.tsx respectively),
                  because every height below is a consequence of that structure
                  rather than a number anyone chose. */}
              <div className="md:hidden">
                {/* Name over email, status pill alongside. */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="mt-0.5 h-3 w-48" />
                  </div>
                  <Skeleton className="h-7 w-28 shrink-0 rounded-full" />
                </div>

                {/* The card's three-row <dl>: When, Doctor, Reason. The doctor
                    row is the tall one — it carries a size-6 avatar. */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="size-6 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>

                {/* Schedule and Cancel. `h-9` is Button's own `size="sm"`. */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Skeleton className="h-9" />
                  <Skeleton className="h-9" />
                </div>
              </div>

              {/* Column order and breakpoints follow columns.tsx exactly:
                  index at lg, Patient always, Status always, Appointment at
                  md, Doctor at lg, Reason at xl, Actions always. */}
              <div className="hidden items-center gap-4 md:flex">
                <Skeleton className="hidden h-4 w-6 lg:block" />
                {/* Two bars, not one: the real cell stacks a 14px name over a
                    12px email, and a single bar is the whole desktop delta. */}
                <div className="min-w-36">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-0.5 h-3 w-40" />
                </div>
                <Skeleton className="h-7 w-28 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <div className="hidden items-center gap-3 lg:flex">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                </div>
                {/* Reason is PRIORITY.xl in columns.tsx and had no placeholder
                    at all — a fidelity gap rather than a height one, since
                    this branch is a flex row. */}
                <Skeleton className="hidden h-4 w-40 xl:block" />
                <Skeleton className="ml-auto h-9 w-40" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Busy>
  );
}

export function AppointmentListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Busy label="Loading your appointments">
      <div className="space-y-4">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </Busy>
  );
}

export function SuccessSkeleton() {
  return (
    <Busy label="Loading appointment details">
      <div className="flex flex-col items-center gap-8 py-10">
        <Skeleton className="size-40 rounded-full" />
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-24 w-full max-w-md rounded-xl" />
      </div>
    </Busy>
  );
}
