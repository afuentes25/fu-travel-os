import type { CatalogFilters } from "@/lib/catalog";

const defaultFilters: CatalogFilters = { sort: "next" };

export function countLavellaActiveFilters(filters: CatalogFilters) {
  return Object.entries(filters).reduce((count, [key, value]) => {
    if (key === "sort") return count;
    if (typeof value === "boolean") return count + (value ? 1 : 0);
    if (typeof value !== "string") return count;
    const normalized = value.trim().toLowerCase();
    return count +
      (normalized &&
      !["all", "todos", "todas"].includes(normalized)
        ? 1
        : 0);
  }, 0);
}

export function clearLavellaCatalogFilters(filters: CatalogFilters) {
  return {
    ...defaultFilters,
    sort: filters.sort || defaultFilters.sort,
  };
}
