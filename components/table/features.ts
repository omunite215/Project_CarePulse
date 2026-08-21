import {
  columnVisibilityFeature,
  tableFeatures as defineTableFeatures,
} from "@tanstack/react-table";

/**
 * The table's feature set, declared once outside any component.
 *
 * Only column visibility is enabled. Filtering, sorting and pagination are all
 * done server-side — see `app/api/v1/appointments/route.ts` — so pulling in
 * `rowSortingFeature` / `rowPaginationFeature` / `columnFilteringFeature` would
 * ship row models that re-process a page the server already processed, and
 * would silently sort only the ten rows currently on screen.
 *
 * TanStack Table v9 made features opt-in precisely so this stays explicit.
 */
export const tableFeatures = defineTableFeatures({
  columnVisibilityFeature,
});
