import { useQuery } from "@tanstack/react-query";
import { getBatchTraceability } from "@/lib/api/batch-traceability";
import {
  getFinishedGoodDetail,
  getFinishedGoodsMaster,
  getRawMaterialBatches,
  getRawMaterialMaster,
  getRawMaterialSummary,
} from "@/lib/api/inventory";
import { inventoryKeys, productionKeys } from "@/lib/react-query/keys";

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

export function useFinishedGoodDetail(itemId: string) {
  return useQuery({
    queryKey: inventoryKeys.finishedGoodDetail(itemId),
    queryFn: () => getFinishedGoodDetail(itemId),
    enabled: Boolean(itemId.trim()),
    staleTime: 15_000,
  });
}

function buildBatchDetailQuery<TQueryKey extends readonly unknown[]>(
  batchCode: string,
  queryKey: TQueryKey
) {
  return {
    queryKey,
    queryFn: () => getBatchTraceability(batchCode),
    enabled: Boolean(batchCode.trim()),
    staleTime: 15_000,
  };
}

export function useRawBatchDetail(batchCode: string) {
  return useQuery(
    buildBatchDetailQuery(batchCode, inventoryKeys.rawBatch(batchCode))
  );
}

export function useWipBatchDetail(batchCode: string) {
  return useQuery(
    buildBatchDetailQuery(batchCode, productionKeys.wipBatch(batchCode))
  );
}

export function useFinishedBundleDetail(batchCode: string) {
  return useQuery(
    buildBatchDetailQuery(batchCode, inventoryKeys.finishedBundle(batchCode))
  );
}
