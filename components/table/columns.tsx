"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Image from "next/image";

import { AppointmentModal } from "@/components/AppointmentModal";
import { StatusBadge } from "@/components/StatusBadge";
import { findDoctor } from "@/constants";
import type { Appointment } from "@/lib/data/types";
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

export const columns: AppointmentColumn[] = [
  {
    id: "index",
    header: "#",
    cell: ({ row }) => (
      <span className="text-14-medium text-muted-foreground">{row.index + 1}</span>
    ),
  },
  {
    accessorKey: "patient",
    header: "Patient",
    cell: ({ row }) => (
      <div className="min-w-[140px]">
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
    cell: ({ row }) => (
      <div className="min-w-[115px]">
        <StatusBadge status={row.original.status} />
      </div>
    ),
  },
  {
    accessorKey: "schedule",
    header: "Appointment",
    cell: ({ row }) => (
      <p className="text-14-regular min-w-[130px] text-foreground">
        {formatDateTime(row.original.schedule).dateTime}
      </p>
    ),
  },
  {
    accessorKey: "primaryPhysician",
    header: "Doctor",
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
    cell: ({ row }) => (
      <p
        className="text-14-regular max-w-[220px] truncate text-foreground/80"
        title={row.original.reason}
      >
        {row.original.reason}
      </p>
    ),
  },
  {
    id: "actions",
    header: () => <span className="pl-4">Actions</span>,
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
