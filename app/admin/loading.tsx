import {
  DataTableSkeleton,
  StatCardsSkeleton,
} from "@/components/states/Skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col space-y-14">
      <div className="admin-header">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-48" />
      </div>

      <div className="admin-main">
        <section className="w-full space-y-4">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-80" />
        </section>

        {/* Stats and table are independent boundaries: three counts paint in
            milliseconds and should not wait on the table. */}
        <StatCardsSkeleton />
        <DataTableSkeleton />
      </div>
    </div>
  );
}
