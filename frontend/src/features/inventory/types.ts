export type ItemCategory = "RAW" | "SEMI_FINISHED" | "FINISHED" | "SCRAP";

export type BaseUnit = "WEIGHT" | "COUNT" | "LENGTH";

export type SteelSpecs = {
  thickness?: number;
  thickness_mm?: number;
  width?: number;
  width_mm?: number;
  diameter?: number;
  grade?: string;
};

export type ItemDefinition = {
  id: string;
  parent_id?: string;
  sku?: string;
  name: string;
  category: ItemCategory;
  base_unit: BaseUnit;
  specs: SteelSpecs;
  specification?: string;
  linked_raw_material_id?: string;
  diameter?: number;
  low_stock_threshold?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SelectableItem = {
  item_id: string;
  label: string;
  category: ItemCategory;
};

export type CreateItemDefinitionInput = {
  name: string;
  category: ItemCategory;
  base_unit: BaseUnit;
  specs: SteelSpecs;
  low_stock_threshold?: number;
};

/** A single aggregated inventory row by item — as returned from the view endpoint. */
export type InventoryViewRow = {
  item_id: string;
  sku?: string;
  name: string;
  specs: Record<string, unknown>;
  total_qty: number;
  available_qty: number;
  reserved_qty: number;
};

/**
 * The full factory-floor inventory snapshot grouped by ledger zone.
 * Keys match Go backend categories exactly (SEMI_FINISHED not SEMI).
 */
export type InventorySnapshot = {
  RAW: InventoryViewRow[];
  SEMI_FINISHED: InventoryViewRow[];
  FINISHED: InventoryViewRow[];
  SCRAP: InventoryViewRow[];
};

export type BatchStatus = "ACTIVE" | "HOLD" | "EXHAUSTED" | "REVERSED";

export type ActiveBatch = {
  batch_id: string;
  batch_code: string;
  arrival_date: string;
  initial_weight: number;
  remaining_weight: number;
  status: BatchStatus;
};

export type ReceiveStockPayload = {
  item_id: string;
  quantity: number;
};

export type ReceiveStockResult = {
  batch_id?: string;
  movement_group_id?: string;
  transaction_id?: string;
};

export type InventoryActionState = {
  ok: boolean;
  message: string;
};

export type DefineMaterialInput = {
  name: string;
  thickness_mm: number;
  width_mm: number;
  low_stock_threshold: number;
};

export type ReceiveStockCommandInput = {
  item_id: string;
  weight: number;
};

export type LogProductionInput = {
  source_batch_id: string;
  output_item_name: string;
  output_item_specs: {
    thickness: number;
    width: number;
    coil_weight: number;
  };
  input_qty: number;
  finished_qty: number;
  scrap_qty: number;
};

/** Raw Material Master row — returned from GET /api/v1/inventory/raw-materials */
export type RawMaterialMasterRow = {
  item_id: string;
  sku: string;
  name: string;
  specification: string;
  specs: Record<string, unknown>;
  available_qty: number;
  reserved_qty: number;
  threshold: number;
  pending_deliveries: number;
  status: "LOW" | "OK";
};

export type RawMaterialSummary = {
  item_id: string;
  sku: string;
  name: string;
  specification: string;
  specs: Record<string, unknown>;
  available_qty: number;
  reserved_qty: number;
  hold_qty: number;
  pending_deliveries: number;
  threshold: number;
};

/** Batch row for raw material detail — returned from GET /api/v1/inventory/raw-materials/:id/batches */
export type RawMaterialBatchRow = {
  batch_id: string;
  batch_code: string;
  vendor_name?: string;
  po_number?: string;
  parent_po_id?: string;
  received_at: string;
  initial_qty: number;
  remaining_qty: number;
  reserved_qty: number;
  available_qty: number;
  status: BatchStatus;
};

export type UpdateBatchStatusPayload = {
  status: "HOLD" | "ACTIVE";
  reason?: string;
};

export type CreateFinishedGoodInput = {
  name: string;
  linked_raw_material_id: string;
  diameter: number;
  low_stock_threshold?: number;
};

export type FinishedGoodMasterRow = {
  item_id: string;
  sku: string;
  name: string;
  diameter: number;
  available_qty: number;
  reserved_qty: number;
  status: "OK" | "LOW" | "OUT";
};

export type FinishedGoodSummary = {
  item_id: string;
  sku: string;
  name: string;
  diameter: number;
  total_qty: number;
  available_qty: number;
  reserved_qty: number;
  hold_qty: number;
  status: "OK" | "LOW" | "OUT";
  batch_count: number;
  low_stock_threshold?: number;
  linked_raw_material_id?: string;
  linked_raw_material_sku?: string;
  linked_raw_material_name?: string;
  linked_raw_material_specification?: string;
};

export type FinishedGoodBatchRow = {
  batch_id: string;
  batch_code: string;
  created_at: string;
  initial_qty: number;
  remaining_qty: number;
  reserved_qty: number;
  available_qty: number;
  status: BatchStatus;
  source_molded_batch_id?: string;
  source_molded_batch_code?: string;
};

export type FinishedGoodRecentPolishingRow = {
  journal_id: string;
  created_at: string;
  finished_batch_id: string;
  finished_batch_code: string;
  source_molded_batch_id?: string;
  source_molded_batch_code?: string;
  output_qty: string;
  scrap_qty: string;
  shortlength_qty: string;
  process_loss_qty: string;
  operator_name?: string;
};

export type FinishedGoodLineageBatchRow = {
  batch_id: string;
  batch_code: string;
  created_at: string;
  status: BatchStatus;
  available_qty: number;
  produced_qty?: number;
  latest_used_at?: string;
  vendor_name?: string;
  po_number?: string;
};

export type FinishedGoodDetail = {
  summary: FinishedGoodSummary;
  batches: FinishedGoodBatchRow[];
  recent_polishing_output: FinishedGoodRecentPolishingRow[];
  source_molded_batches: FinishedGoodLineageBatchRow[];
  source_raw_batches: FinishedGoodLineageBatchRow[];
};
