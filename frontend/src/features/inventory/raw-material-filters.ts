export type RawMaterialBatchFilterState = {
  vendor: string;
  status: string;
  from: string;
  to: string;
  batchCode: string;
};

export const DEFAULT_RAW_MATERIAL_BATCH_FILTERS: RawMaterialBatchFilterState = {
  vendor: "",
  status: "",
  from: "",
  to: "",
  batchCode: "",
};

export function parseRawMaterialBatchFilters(
  searchParams: URLSearchParams,
): RawMaterialBatchFilterState {
  return {
    vendor: searchParams.get("vendor")?.trim() ?? "",
    status: searchParams.get("status")?.trim().toUpperCase() ?? "",
    from: searchParams.get("from")?.trim() ?? "",
    to: searchParams.get("to")?.trim() ?? "",
    batchCode: searchParams.get("batch")?.trim() ?? "",
  };
}

export function serializeRawMaterialBatchFilters(
  filters: RawMaterialBatchFilterState,
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.vendor.trim()) {
    params.set("vendor", filters.vendor.trim());
  }
  if (filters.status.trim()) {
    params.set("status", filters.status.trim().toUpperCase());
  }
  if (filters.from.trim()) {
    params.set("from", filters.from.trim());
  }
  if (filters.to.trim()) {
    params.set("to", filters.to.trim());
  }
  if (filters.batchCode.trim()) {
    params.set("batch", filters.batchCode.trim());
  }

  return params;
}
