"use client";

import { DownloadIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { APPOINTMENT_STATUSES } from "@/lib/data/types";
import { StatusLabel } from "@/constants";
import type { useAppointmentFilters } from "./useAppointmentFilters";

interface Props {
  controller: ReturnType<typeof useAppointmentFilters>;
  onExport: () => void;
  canExport: boolean;
}

export function AppointmentFilters({ controller, onExport, canExport }: Props) {
  const { filters, update, clear, isFiltered } = controller;

  // The input is locally controlled and pushed to the URL on a debounce;
  // writing every keystroke straight to the URL would refetch per character.
  const [search, setSearch] = useState(filters.q);

  useEffect(() => setSearch(filters.q), [filters.q]);

  useEffect(() => {
    if (search === filters.q) return;
    const timer = setTimeout(() => update({ q: search }), 350);
    return () => clearTimeout(timer);
  }, [search, filters.q, update]);

  return (
    <div className="grid w-full gap-3 sm:grid-cols-2 lg:flex lg:items-center">
      <div className="relative flex-1">
        <SearchIcon
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search patient, doctor or reason"
          aria-label="Search appointments"
          className="shad-input pl-9"
        />
      </div>

      <Select
        value={filters.status}
        onValueChange={(value) =>
          update({ status: value as typeof filters.status })
        }
      >
        <SelectTrigger
          className="shad-select-trigger"
          aria-label="Filter by status"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="shad-select-content">
          <SelectItem value="all">All statuses</SelectItem>
          {APPOINTMENT_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {StatusLabel[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 sm:col-span-2 lg:col-auto">
        <label className="sr-only" htmlFor="from">
          From date
        </label>
        <Input
          id="from"
          type="date"
          value={filters.from ? toInputDate(filters.from) : ""}
          onChange={(event) =>
            update({ from: parseInputDate(event.target.value) })
          }
          className="shad-input w-full"
        />
        <span className="text-muted-foreground" aria-hidden="true">
          –
        </span>
        <label className="sr-only" htmlFor="to">
          To date
        </label>
        <Input
          id="to"
          type="date"
          value={filters.to ? toInputDate(filters.to) : ""}
          onChange={(event) =>
            update({ to: parseInputDate(event.target.value) })
          }
          className="shad-input w-full"
        />
      </div>

      {isFiltered ? (
        <Button
          variant="ghost"
          onClick={clear}
          className="gap-1 text-foreground/80"
          aria-label="Clear all filters"
        >
          <XIcon className="size-4" aria-hidden="true" />
          Clear
        </Button>
      ) : null}

      <Button
        variant="outline"
        onClick={onExport}
        disabled={!canExport}
        className="shad-gray-btn gap-2"
      >
        <DownloadIcon className="size-4" aria-hidden="true" />
        Export CSV
      </Button>
    </div>
  );
}

function toInputDate(date: Date) {
  // `toISOString` would shift into UTC and can show the previous day; the
  // <input type="date"> value must be the local calendar date.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseInputDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
