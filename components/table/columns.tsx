"use client";

import type {
  CellData,
  ColumnDef,
  RowData,
  TableFeatures,
} from "@tanstack/react-table";
import Image from "next/image";

import { AppointmentModal } from "@/components/AppointmentModal";
import { StatusBadge } from "@/components/StatusBadge";
import { findDoctor } from "@/constants";
import type { Appointment, AppointmentSortKey } from "@/lib/data/types";
import { formatDateTime } from "@/lib/utils";
import type { tableFeatures } from "./features";

/**
 * Admin table columns.
 *
 * `ColumnDef` gained a leading `TFeatures` generic in TanStack Table v9, so the
 * feature set has to be threaded through here — which is also what keeps
 * `columns` and `useTable` from drifting apart.
 */
export type AppointmentColumn = ColumnDef<
  typeof tableFeatures,
  Appointment
>;

/**
 * Column priority.
 *
 * Below `md` the table is not rendered at all (see DataTable). From `md` up,
 * columns appear in order of how much an operator needs them, so 768–1023 is a
 * readable four-column table instead of a seven-column squeeze — and `xl` gets
 * real work: Reason stops truncating at 220px on a wide monitor.
 */
const PRIORITY = {
  always: "",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
} as const;

/**
 * Installed v9.1.2's real `ColumnMeta` takes three generics — `TFeatures`,
 * `TData`, and a `TValue` that defaults to `CellData` — not the two-param
 * guess this augmentation started from. Declaration merging requires matching
 * arity, so all three are declared here even though `className` does not vary
 * per-value and never touches `TValue` in its own type.
 */
declare module "@tanstack/react-table" {
  interface ColumnMeta<
    TFeatures extends TableFeatures,
    TData extends RowData,
    TValue extends CellData = CellData,
  > {
    /** Responsive visibility class, applied to header and cell alike. */
    className?: string;
    /**
     * Present only on columns `/api/v1/appointments` can order by. Absent means
     * the header stays inert text — `status`, `primaryPhysician` and `reason`
     * have no server-side ordering, and a control that looked clickable and did
     * nothing would be worse than no control at all.
     */
    sortKey?: AppointmentSortKey;
  }
}

export const columns: AppointmentColumn[] = [
  {
    id: "index",
    header: "#",
    meta: { className: PRIORITY.lg },
    cell: ({ row }) => (
      <span className="text-14-medium text-muted-foreground">{row.index + 1}</span>
    ),
  },
  {
    accessorKey: "patient",
    header: "Patient",
    meta: { className: PRIORITY.always, sortKey: "patient" },
    cell: ({ row }) => (
      <div className="min-w-36">
        <p className="text-14-medium text-foreground">
          {row.original.patient.name}
        </p>
        <p className="text-12-regular text-muted-foreground">
          {row.original.patient.email}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: { className: PRIORITY.always },
    cell: ({ row }) => (
      <div className="min-w-28">
        <StatusBadge status={row.original.status} />
      </div>
    ),
  },
  {
    accessorKey: "schedule",
    header: "Appointment",
    meta: { className: PRIORITY.md, sortKey: "schedule" },
    cell: ({ row }) => (
      <p className="text-14-regular min-w-32 text-foreground">
        {formatDateTime(row.original.schedule).dateTime}
      </p>
    ),
  },
  {
    accessorKey: "primaryPhysician",
    header: "Doctor",
    meta: { className: PRIORITY.lg },
    cell: ({ row }) => {
      const doctor = findDoctor(row.original.primaryPhysician);
      return (
        <div className="flex items-center gap-3">
          {doctor ? (
            <Image
              src={doctor.image}
              alt=""
              aria-hidden="true"
              width={100}
              height={100}
              className="size-8 rounded-full border border-border"
            />
          ) : null}
          <p className="text-14-regular whitespace-nowrap text-foreground">
            Dr. {row.original.primaryPhysician}
          </p>
        </div>
      );
    },
  },
  {
    accessorKey: "reason",
    header: "Reason",
    meta: { className: PRIORITY.xl },
    cell: ({ row }) => (
      <p
        className="text-14-regular max-w-56 truncate text-foreground/80 xl:max-w-none xl:whitespace-normal"
        title={row.original.reason}
      >
        {row.original.reason}
      </p>
    ),
  },
  {
    id: "actions",
    header: () => <span className="pl-4">Actions</span>,
    meta: { className: PRIORITY.always },
    cell: ({ row }) => {
      const appointment = row.original;
      // A cancelled appointment has nowhere left to go, so offering Schedule
      // and Cancel on it would be two dead buttons.
      if (appointment.status === "cancelled") {
        return (
          <span className="text-12-regular text-muted-foreground">No actions</span>
        );
      }

      return (
        <div className="flex gap-1">
          <AppointmentModal
            type="schedule"
            userId={appointment.userId}
            appointment={appointment}
          />
          <AppointmentModal
            type="cancel"
            userId={appointment.userId}
            appointment={appointment}
          />
        </div>
      );
    },
  },
];
