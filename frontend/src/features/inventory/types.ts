export type ItemCategory = "RAW" | "SEMI_FINISHED" | "FINISHED" | "SCRAP";

export type BaseUnit = "WEIGHT" | "COUNT" | "LENGTH";

export type SteelSpecs = {
  thickness: number;
  width: number;
  grade: string;
  coil_weight: number;
};

export type ItemDefinition = {
  id: string;
  parent_id?: string;
  sku?: string;
  name: string;
  category: ItemCategory;
  base_unit: BaseUnit;
  specs: SteelSpecs;
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
  parent_id?: string;
  sku: string;
  name: string;
  category: ItemCategory;
  base_unit: BaseUnit;
  specs: SteelSpecs;
};

/** A single aggregated inventory row by item — as returned from the view endpoint. */
export type InventoryViewRow = {
  item_id: string;
  name: string;
  specs: Record<string, unknown>;
  total_qty: number;
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

export type ActiveBatch = {
  batch_id: string;
  batch_code: string;
  arrival_date: string | null;
  current_weight: number;
  label: string;
};

export type ReceiveStockPayload = {
  item_id: string;
  batch_code: string;
  quantity: number;
  unit_cost: number;
  /** Must be one of: PURCHASE_RECEIPT | PRODUCTION_JOURNAL | TRANSFER | ADJUSTMENT */
  reference_type:
    | "PURCHASE_RECEIPT"
    | "PRODUCTION_JOURNAL"
    | "TRANSFER"
    | "ADJUSTMENT";
  /** UUID v4 — the source document ID (e.g. PO number as UUID) */
  reference_id: string;
  notes?: string;
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
  thickness: number;
  width: number;
  grade: string;
};

export type ReceiveStockCommandInput = {
  item_id: string;
  batch_code?: string;
  weight: number;
  price: number;
};

export type LogProductionInput = {
  source_batch_id: string;
  output_item_name: string;
  output_item_specs: {
    thickness: number;
    width: number;
    grade: string;
    coil_weight: number;
  };
  input_qty: number;
  finished_qty: number;
  scrap_qty: number;
};
