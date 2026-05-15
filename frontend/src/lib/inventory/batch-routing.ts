import type {
  BatchDetailBatch,
  InventoryBatchType,
} from "@/lib/api/batch-traceability";

export function isInventoryBatchType(
  value: string
): value is InventoryBatchType {
  return value === "RAW" || value === "MOLDED" || value === "FINISHED";
}

export function getBatchDetailHref(
  batchType: InventoryBatchType,
  batchCode: string
): string {
  const encoded = encodeURIComponent(batchCode.trim());

  switch (batchType) {
    case "RAW":
      return `/inventory/raw-materials/batches/${encoded}`;
    case "MOLDED":
      return `/production/wip/batches/${encoded}`;
    case "FINISHED":
      return `/inventory/finished-goods/batches/${encoded}`;
  }
}

export function getBatchDetailHrefForBatch(
  batch: Pick<BatchDetailBatch, "batch_type" | "batch_code">
): string {
  return getBatchDetailHref(batch.batch_type, batch.batch_code);
}
