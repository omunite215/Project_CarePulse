"use client";

import { useTable } from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  SearchXIcon,
} from "lucide-react";

import { EmptyState } from "@/components/states/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Appointment } from "@/lib/data/types";
import { AppointmentRowCard } from "./AppointmentRowCard";
import { columns } from "./columns";
import { tableFeatures } from "./features";
import { ariaSortFor, nextSortState, type SortState } from "./sorting";

interface DataTableProps {
  data: Appointment[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Server-side ordering, held in the URL by `useAppointmentFilters`. */
  sortState: SortState;
  onSortChange: (next: SortState) => void;
  /** True while a filter or page change is in flight. */
  isFetching?: boolean;
  /** Shown when a filter matched nothing, rather than "no appointments". */
  isFiltered?: boolean;
  onClearFilters?: () => void;
}

/**
 * The admin table.
 *
 * TanStack Table v9: `useTable` (not `useReactTable`), an explicit `features`
 * object, and `table.FlexRender` in place of calling `flexRender` directly.
 *
 * Pagination is driven by props rather than the table's own state because the
 * server paginates — the table only ever holds the current page, so asking it
 * to paginate would page within ten rows.
 */
export function DataTable({
  data,
  totalCount,
  page,
  pageSize,
  onPageChange,
  sortState,
  onSortChange,
  isFetching,
  isFiltered,
  onClearFilters,
}: DataTableProps) {
  const table = useTable({
    features: tableFeatures,
    columns,
    data,
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  if (data.length === 0) {
    return (
      <div className="data-table">
        <EmptyState
          Icon={SearchXIcon}
          title={
            isFiltered ? "No appointments match those filters" : "No appointments yet"
          }
          description={
            isFiltered
              ? "Try widening the date range or clearing the search."
              : "Appointments will appear here as patients book them."
          }
          action={
            isFiltered && onClearFilters ? (
              <Button
                variant="outline"
                onClick={onClearFilters}
                className="shad-gray-btn"
              >
                Clear filters
              </Button>
            ) : null
          }
        />
      </div>
    );
  }

  return (
    <div className="data-table">
      {/* aria-busy tells assistive tech the table is refreshing, while the rows
          stay on screen thanks to TanStack Query's placeholderData. */}
      <div
        aria-busy={isFetching}
        className={isFetching ? "opacity-60 transition-opacity" : undefined}
      >
        {/* Two renderers, one data source. `md:hidden` / `hidden md:block`
            rather than a JS width check: a media query is correct on the
            server's first paint, where `window` does not exist.
            `<ul>`/`<li>` (not `<div>`/`<article>`) so screen readers get the
            row count and position ("2 of 10") the table gives for free via
            its own row/cell roles — a card list on its own has nothing to
            replace that with. No explicit `role="list"`: the element already
            has that role implicitly, and the lint config (jsx-a11y/no-
            redundant-roles) treats restating it as a defect, not a safety
            net. */}
        <ul className="divide-y divide-border md:hidden">
          {table.getRowModel().rows.map((row) => (
            <AppointmentRowCard key={row.id} appointment={row.original} />
          ))}
        </ul>

        <div className="hidden md:block">
          <Table className="shad-table">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="shad-table-row-header">
                  {headerGroup.headers.map((header) => {
                    const sortKey = header.column.columnDef.meta?.sortKey;
                    const ariaSort = sortKey
                      ? ariaSortFor(sortState, sortKey)
                      : undefined;

                    return (
                      <TableHead
                        key={header.id}
                        className={header.column.columnDef.meta?.className}
                        // On the `th`, not on the button: `aria-sort` is a
                        // header property, and only this element is the header.
                        // It also means the button's accessible name stays the
                        // column label alone — spelling the state into the name
                        // as well would announce it twice.
                        aria-sort={ariaSort}
                      >
                        {sortKey ? (
                          // No height or vertical padding of its own.
                          // `TableHead` is a fixed `h-12` that
                          // `DataTableSkeleton` mirrors by hand, so a control
                          // that grew the header would desync the skeleton
                          // silently — the row parity test measures rows.
                          <button
                            type="button"
                            onClick={() =>
                              onSortChange(nextSortState(sortState, sortKey))
                            }
                            className="inline-flex items-center gap-1 rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            <table.FlexRender header={header} />
                            {ariaSort === "ascending" ? (
                              <ArrowUpIcon
                                className="size-3.5"
                                aria-hidden="true"
                              />
                            ) : ariaSort === "descending" ? (
                              <ArrowDownIcon
                                className="size-3.5"
                                aria-hidden="true"
                              />
                            ) : (
                              <ChevronsUpDownIcon
                                className="size-3.5 opacity-50"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="shad-table-row">
                  {row.getAllCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.columnDef.meta?.className}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="table-actions">
        <p className="text-14-regular text-muted-foreground" aria-live="polite">
          Showing {from}–{to} of {totalCount}
        </p>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="shad-gray-btn gap-1"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeftIcon className="size-4" aria-hidden="true" />
            Previous
          </Button>
          <span className="text-14-medium px-2 text-foreground/80">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="shad-gray-btn gap-1"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Next
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
