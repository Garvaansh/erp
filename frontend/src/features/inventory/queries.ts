import { useQuery } from "@tanstack/react-query";
import {
  getFinishedGoodDetail,
  getFinishedGoodsMaster,
  getRawMaterialBatches,
  getRawMaterialMaster,
  getRawMaterialSummary,
} from "@/lib/api/inventory";
import { inventoryKeys } from "@/lib/react-query/keys";

export function useRawMaterialMaster() {
  return useQuery({
    queryKey: inventoryKeys.rawMaterials(),
    queryFn: getRawMaterialMaster,
    staleTime: 30_000,
  });
}

export function useRawMaterialSummary(itemId: string) {
  return useQuery({
    queryKey: inventoryKeys.rawMaterialSummary(itemId),
    queryFn: () => getRawMaterialSummary(itemId),
    enabled: Boolean(itemId.trim()),
    staleTime: 15_000,
  });
}

export function useRawMaterialBatches(itemId: string) {
  return useQuery({
    queryKey: inventoryKeys.rawMaterialBatches(itemId),
    queryFn: () => getRawMaterialBatches(itemId),
    enabled: Boolean(itemId.trim()),
    staleTime: 15_000,
  });
}

export function useFinishedGoodsMaster() {
  return useQuery({
    queryKey: inventoryKeys.finishedGoods(),
    queryFn: getFinishedGoodsMaster,
    staleTime: 30_000,
  });
}

export function useFinishedGoodDetail(productId: string) {
  return useQuery({
    queryKey: inventoryKeys.finishedGoodDetail(productId),
    queryFn: () => getFinishedGoodDetail(productId),
    enabled: Boolean(productId.trim()),
    staleTime: 15_000,
  });
}
