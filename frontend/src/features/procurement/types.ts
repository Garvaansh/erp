export type ProcurementStatus = "PENDING" | "PARTIAL" | "COMPLETED" | "CLOSED";
export type ProcurementPaymentStatus =
  | "PENDING"
  | "PARTIAL"
  | "COMPLETED"
  | "UNPAID"
  | "PAID";
export type ProcurementPaymentInputStatus = "PENDING" | "PARTIAL" | "COMPLETED";

export type PurchaseOrder = {
  id: string;
  po_number: string;
  transaction_id: string;
  vendor_name: string;
  vendor_code?: string;
  vendor_id?: string;
  vendor_short_name?: string;
  vendor_contact_person?: string;
  vendor_phone?: string;
  item_id: string;
  item_name: string;
  item_sku?: string;
  ordered_qty: number;
  received_qty: number;
  unit_price: number;
  vendor_invoice_ref?: string;
  payment_status?: ProcurementPaymentStatus;
  total_value?: number;
  paid_amount?: number;
  due_amount?: number;
  total_batches?: number;
  notes?: string;
  status: ProcurementStatus;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  last_action?: string;
  last_action_at?: string;
  last_log_note?: string;
};

export type InventoryBatch = {
  batch_id: string;
  batch_code?: string;
  initial_qty?: number;
  remaining_qty?: number;
  status?: string;
  unit_cost?: number;
  transaction_id?: string;
  received_at?: string;
};

export type ProcurementLog = {
  action: string;
  note?: string;
  created_at?: string;
};

export type ProcurementDetail = {
  po: PurchaseOrder;
  batches: {
    total: number;
    active: number;
    reversed: number;
    items: InventoryBatch[];
  };
  logs: {
    items: ProcurementLog[];
    last_action?: ProcurementLog;
  };
};

export type ProcurementList = {
  pending: PurchaseOrder[];
  recent: PurchaseOrder[];
};

export type CreatePurchaseOrderPayload = {
  item_id: string;
  vendor_id?: string;
  vendor_name: string;
  ordered_qty: number;
  unit_price: number;
  vendor_invoice_ref?: string;
  notes?: string;
};

export type UpdatePurchaseOrderPayload = {
  item_id?: string;
  ordered_qty?: number;
  unit_price?: number;
  vendor_invoice_ref?: string;
  notes?: string;
  edit_reason: string;
};

export type ReceiveGoodsPayload = {
  qty: number;
};

export type ReverseReceiptPayload = {
  batch_id?: string;
  batch_ids?: string[];
  reason: string;
};

export type CloseOrderPayload = {
  reason: string;
};

export type CreatePurchaseOrderResult = {
  purchase_order_id: string;
  po_number: string;
  transaction_id: string;
  status: ProcurementStatus;
};

export type UpdatePurchaseOrderResult = {
  purchase_order_id: string;
  item_id: string;
  ordered_qty: number;
  received_qty: number;
  unit_price: number;
  vendor_invoice_ref?: string;
  notes?: string;
  status: ProcurementStatus;
};

export type ReceiveGoodsResult = {
  purchase_order_id: string;
  batch_id: string;
  batch_code: string;
  transaction_id: string;
  movement_group_id: string;
  received_qty: number;
  status: ProcurementStatus;
};

export type ReverseReceiptResult = {
  purchase_order_id: string;
  batch_id?: string;
  reversed_batch_count?: number;
  received_qty: number;
  status: ProcurementStatus;
};

export type CloseOrderResult = {
  purchase_order_id: string;
  status: ProcurementStatus;
};

export type ProcurementOrderStatus =
  | ProcurementStatus
  | "DELIVERED"
  | "CANCELLED";

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
