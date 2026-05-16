import { apiClient } from "@/lib/api/api-client";

export type InventoryBatchType = "RAW" | "MOLDED" | "FINISHED";

export type BatchDetailBatch = {
  batch_id: string;
  batch_code: string;
  item_id: string;
  batch_type: InventoryBatchType;
  status: string;
  initial_qty: number;
  remaining_qty: number;
  reserved_qty: number;
  created_at: string;
  item_name: string;
  item_sku: string;
  item_category: string;
};

export type BatchProductionRun = {
  production_run_id: string;
  run_sequence: number;
  input_qty: number;
  output_qty: number;
  scrap_qty: number;
  shortlength_qty: number;
  process_loss_qty: number;
  yield_pct: number;
  production_stage: string;
  operator_name: string;
  status: string;
  created_at: string;
};

export type BatchLineageNode = {
  batch_id: string;
  batch_code: string;
  batch_type: InventoryBatchType;
  status: string;
  initial_qty: number;
  remaining_qty: number;
  quantity_consumed: number;
  depth: number;
  created_at: string;
  item_name: string;
  item_sku: string;
};

export type BatchConsumption = {
  id: string;
  production_run_id: string;
  source_batch_code: string;
  source_batch_type: InventoryBatchType;
  target_batch_code: string;
  target_batch_type: string;
  quantity_consumed: number;
  batch_remaining_before: number;
  batch_remaining_after: number;
  created_at: string;
};

export type BatchVendorOrigin = {
  vendor_name: string;
  po_number: string;
  procurement_date: string;
  raw_batch_code: string;
};

export type BatchTraceabilityData = {
  batch: BatchDetailBatch;
  production_run: BatchProductionRun | null;
  lineage: BatchLineageNode[];
  consumptions: BatchConsumption[];
  vendors: BatchVendorOrigin[];
};

export async function getBatchTraceability(
  batchCode: string
): Promise<BatchTraceabilityData> {
  return apiClient<BatchTraceabilityData>(
    `/inventory/batches/${encodeURIComponent(batchCode.trim())}`,
    { method: "GET" }
  );
}
