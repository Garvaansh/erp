import { useQuery } from "@tanstack/react-query";
import {
  getProcurementMaterialOptions,
  getProcurementDetail,
  getProcurementList,
  type ProcurementListParams,
} from "@/features/procurement/api";
import { procurementKeys } from "@/lib/react-query/keys";

export function procurementListQueryOptions(
  filters: ProcurementListParams = {},
) {
  return {
    queryKey: procurementKeys.list(filters),
    queryFn: () => getProcurementList(filters),
    staleTime: 30_000,
  };
}

export function procurementDetailQueryOptions(id: string) {
  return {
    queryKey: procurementKeys.detail(id),
    queryFn: () => getProcurementDetail(id),
    staleTime: 15_000,
  };
}

export function procurementMaterialOptionsQueryOptions() {
  return {
    queryKey: procurementKeys.materialOptions(),
    queryFn: () => getProcurementMaterialOptions(),
  };
}

export function useProcurementList(filters: ProcurementListParams = {}) {
  return useQuery(procurementListQueryOptions(filters));
}

export function useProcurementDetail(id: string, enabled = true) {
  return useQuery({
    ...procurementDetailQueryOptions(id),
    enabled: enabled && Boolean(id.trim()),
    refetchOnWindowFocus: false,
  });
}

export function useProcurementMaterialOptions() {
  return useQuery(procurementMaterialOptionsQueryOptions());
}
