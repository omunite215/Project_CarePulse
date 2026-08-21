import { Skeleton } from "@/components/ui/skeleton";

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
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** One labelled input. */
export function FieldSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Skeleton className="mb-2 h-4 w-24" />
      <Skeleton className="h-11 w-full" />
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

export function RegisterFormSkeleton() {
  return (
    <Busy label="Loading registration form">
      <div className="space-y-12">
        <div className="space-y-3">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-5 w-72" />
        </div>

        {["Personal", "Medical", "Identification"].map((section) => (
          <section
            key={section}
            className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3"
          >
            <Skeleton className="col-span-full h-6 w-40" />
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton />
          </section>
        ))}
      </div>
    </Busy>
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

export function DataTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <Busy label="Loading appointments">
      <div className="data-table">
        <Skeleton className="hidden h-12 w-full rounded-none md:block" />
        <div className="divide-y divide-border">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="p-4">
              {/* Card shape below md, row shape from md up — the skeleton has
                  to switch with the content or it reintroduces the shift. */}
              <div className="space-y-2 md:hidden">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-7 w-28 rounded-full" />
                <Skeleton className="h-8 w-full" />
              </div>
              <div className="hidden items-center gap-4 md:flex">
                <Skeleton className="hidden h-4 w-6 lg:block" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-7 w-28 rounded-full" />
                <Skeleton className="h-4 w-40" />
                <div className="hidden items-center gap-3 lg:flex">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="ml-auto h-8 w-40" />
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
