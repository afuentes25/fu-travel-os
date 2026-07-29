import type { Agency, LavellaCatalogColumns } from "@/types";

export const LAVELLA_CATALOG_COLUMN_OPTIONS = [3, 4] as const;

export function resolveLavellaCatalogColumns(
  agency: Agency,
): LavellaCatalogColumns {
  return agency.settings.lavella?.catalogColumns === 3 ? 3 : 4;
}
