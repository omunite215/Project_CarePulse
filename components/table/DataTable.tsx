"use client";

import { useTable } from "@tanstack/react-table";
import { ChevronLeftIcon, ChevronRightIcon, SearchXIcon } from "lucide-react";

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
import { columns } from "./columns";
import { tableFeatures } from "./features";

interface DataTableProps {
  data: Appointment[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
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
        <Table className="shad-table">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="shad-table-row-header"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    <table.FlexRender header={header} />
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="shad-table-row">
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
