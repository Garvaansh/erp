type ReportDateFilters = {
  from: string;
  to: string;
};

export const reportKeys = {
  all: ["reports"] as const,
  purchase: (filters: ReportDateFilters) =>
    [...reportKeys.all, "purchase", filters.from, filters.to] as const,
  inventory: (filters: ReportDateFilters) =>
    [...reportKeys.all, "inventory", filters.from, filters.to] as const,
  sales: (filters: ReportDateFilters) =>
    [...reportKeys.all, "sales", filters.from, filters.to] as const,
  list: (type: string, filters: ReportDateFilters) =>
    [...reportKeys.all, type, filters.from, filters.to] as const,
};
