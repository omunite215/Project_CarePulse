"use client";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { StatCard } from "@/components/StatCard";
import { DataTable } from "@/components/table/DataTable";
import { ErrorState } from "@/components/states/ErrorState";
import { DataTableSkeleton } from "@/components/states/Skeletons";
import { APPOINTMENTS_PAGE_SIZE } from "@/constants";
import { appointmentsToCsv, downloadCsv } from "@/lib/csv";
import { appointmentListOptions } from "@/lib/query/appointments";
import { AppointmentFilters } from "./AppointmentFilters";
import { useAppointmentFilters } from "./useAppointmentFilters";

/**
 * The admin dashboard body.
 *
 * A client component so it can own polling, URL-driven filtering and pagination
 * — but its first render is served from the cache the RSC shell seeded via
 * `HydrationBoundary`, so opening `/admin` makes zero fetches. Watch the network
 * panel on first paint: it should be empty.
 */
export function AdminDashboard() {
  const controller = useAppointmentFilters();
  const query = controller.toQuery();

  const { data, isPending, isError, error, isFetching, refetch } = useQuery({
    ...appointmentListOptions(query),
    // Appointments are booked by patients while an operator is looking at this
    // screen, so the list refreshes on a slow cadence rather than going stale.
    refetchInterval: 60_000,
  });

  if (isPending) {
    return (
      <>
        <section className="admin-stat">
          <StatCard type="scheduled" count={0} label="Scheduled appointments" />
          <StatCard type="pending" count={0} label="Pending appointments" />
          <StatCard type="cancelled" count={0} label="Cancelled appointments" />
        </section>
        <DataTableSkeleton />
      </>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Could not load appointments"
        description="The dashboard could not reach the server. Nothing has been changed."
        onRetry={() => void refetch()}
        detail={error instanceof Error ? error.message : undefined}
      />
    );
  }

  function handleExport() {
    if (!data || data.documents.length === 0) return;

    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `carepulse-appointments-${stamp}.csv`,
      appointmentsToCsv(data.documents),
    );
    // Exports only the current page, and says so rather than implying it
    // covered every filtered row.
    toast.success(`Exported ${data.documents.length} appointment(s).`);
  }

  return (
    <>
      <section className="admin-stat">
        <StatCard
          type="scheduled"
          count={data.counts.scheduledCount}
          label="Scheduled appointments"
        />
        <StatCard
          type="pending"
          count={data.counts.pendingCount}
          label="Pending appointments"
        />
        <StatCard
          type="cancelled"
          count={data.counts.cancelledCount}
          label="Cancelled appointments"
        />
      </section>

      <AppointmentFilters
        controller={controller}
        onExport={handleExport}
        canExport={data.documents.length > 0}
      />

      <DataTable
        data={data.documents}
        totalCount={data.totalCount}
        page={controller.filters.page}
        pageSize={APPOINTMENTS_PAGE_SIZE}
        onPageChange={controller.setPage}
        isFetching={isFetching}
        isFiltered={controller.isFiltered}
        onClearFilters={controller.clear}
      />
    </>
  );
}
