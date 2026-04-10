export type ProcurementOrderStatus = "PENDING" | "DELIVERED" | "CANCELLED";

export type ProcurementOrderListItem = {
  id: string;
  po_number: string;
  supplier_name: string;
  item_name?: string;
  item_sku?: string;
  ordered_qty: number;
  received_qty: number;
  remaining_qty: number;
  unit_price: number;
  status: ProcurementOrderStatus;
  created_at?: string;
};

export type ProcurementBatch = {
  batch_id: string;
  batch_code: string;
  initial_qty: number;
  remaining_qty: number;
  received_at?: string;
  transaction_id?: string;
};

export type ProcurementOrderDetails = {
  order: ProcurementOrderListItem;
  batches: ProcurementBatch[];
};

export type ProcurementMaterialOption = {
  item_id: string;
  label: string;
};

export type CreatePOInput = {
  item_id: string;
  supplier_name: string;
  ordered_qty: number;
  unit_price: number;
};

export type ReceiveStockInput = {
  po_id: string;
  remaining_qty: number;
  actual_weight: number;
};

export type VoidReceiptInput = {
  po_id: string;
  transaction_id: string;
};

export type CreatePOResult = {
  purchase_order_id?: string;
  po_number?: string;
};

export type ReceiveStockResult = {
  purchase_order_id?: string;
  po_number?: string;
  batch_id?: string;
  batch_code?: string;
  movement_group_id?: string;
  transaction_id?: string;
};

export type VoidReceiptResult = {
  transaction_id?: string;
  po_id?: string;
  reverted?: boolean;
};

export type ProcurementActionResult<T = unknown> = {
  ok: boolean;
  error?: string;
  data?: T;
};
