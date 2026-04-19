import { ApiClientError, apiClient } from "@/lib/api/api-client";
import type {
  CloseOrderPayload,
  CloseOrderResult,
  CreatePurchaseOrderPayload,
  CreatePurchaseOrderResult,
  InventoryBatch,
  ProcurementDetail,
  ProcurementList,
  ProcurementLog,
  ProcurementMaterialOption,
  ProcurementPaymentStatus,
  ProcurementStatus,
  PurchaseOrder,
  ReceiveGoodsPayload,
  ReceiveGoodsResult,
  ReverseReceiptPayload,
  ReverseReceiptResult,
  UpdatePurchaseOrderPayload,
  UpdatePurchaseOrderResult,
} from "@/features/procurement/types";

export type ProcurementListParams = {
  limit?: number;
  offset?: number;
};

const PROCUREMENT_STATUSES: readonly ProcurementStatus[] = [
  "PENDING",
  "PARTIAL",
  "COMPLETED",
  "CLOSED",
] as const;

const PROCUREMENT_PAYMENT_STATUSES: readonly ProcurementPaymentStatus[] = [
  "PENDING",
  "PARTIAL",
  "COMPLETED",
  "UNPAID",
  "PAID",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function invalidPayload(fieldName: string): never {
  throw new ApiClientError(`Invalid procurement payload: ${fieldName}`, 502);
}

function asRequiredString(value: unknown, fieldName: string): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return invalidPayload(fieldName);
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function asRequiredNumber(value: unknown, fieldName: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return invalidPayload(fieldName);
}

function asOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function asStatus(value: unknown, fieldName: string): ProcurementStatus {
  const normalized = asRequiredString(value, fieldName).toUpperCase();

  if ((PROCUREMENT_STATUSES as readonly string[]).includes(normalized)) {
    return normalized as ProcurementStatus;
  }

  return invalidPayload(`status:${fieldName}`);
}

function asOptionalPaymentStatus(
  value: unknown,
): ProcurementPaymentStatus | undefined {
  const raw = asOptionalString(value);
  if (!raw) {
    return undefined;
  }

  const normalized = raw.toUpperCase();
  if (
    (PROCUREMENT_PAYMENT_STATUSES as readonly string[]).includes(normalized)
  ) {
    return normalized as ProcurementPaymentStatus;
  }

  return undefined;
}

function parsePurchaseOrderListRow(payload: unknown): PurchaseOrder {
  if (!isRecord(payload)) {
    return invalidPayload("list row");
  }

  return {
    id: asRequiredString(payload.id, "id"),
    po_number: asRequiredString(payload.po_number, "po_number"),
    transaction_id: asRequiredString(payload.transaction_id, "transaction_id"),
    vendor_name: asRequiredString(payload.vendor_name, "vendor_name"),
    vendor_code: asOptionalString(payload.vendor_code),
    vendor_id: asOptionalString(payload.vendor_id),
    vendor_short_name: asOptionalString(payload.vendor_short_name),
    vendor_contact_person: asOptionalString(payload.vendor_contact_person),
    vendor_phone: asOptionalString(payload.vendor_phone),
    item_id: asRequiredString(payload.item_id, "item_id"),
    item_name: asRequiredString(payload.item_name, "item_name"),
    item_sku: asOptionalString(payload.item_sku),
    ordered_qty: asRequiredNumber(payload.ordered_qty, "ordered_qty"),
    received_qty: asRequiredNumber(payload.received_qty, "received_qty"),
    unit_price: asRequiredNumber(payload.unit_price, "unit_price"),
    vendor_invoice_ref: asOptionalString(payload.vendor_invoice_ref),
    payment_status: asOptionalPaymentStatus(payload.payment_status),
    total_value: asOptionalNumber(payload.total_value),
    paid_amount: asOptionalNumber(payload.paid_amount),
    due_amount: asOptionalNumber(payload.due_amount),
    status: asStatus(payload.status, "status"),
    created_at: asOptionalString(payload.created_at),
    updated_at: asOptionalString(payload.updated_at),
    last_action: asOptionalString(payload.last_action),
    last_action_at: asOptionalString(payload.last_action_at),
    total_batches: asOptionalNumber(payload.total_batches),
  };
}

function parseInventoryBatchRow(payload: unknown): InventoryBatch | null {
  if (!isRecord(payload)) {
    return null;
  }

  const batchID = asOptionalString(payload.batch_id);
  if (!batchID) {
    return null;
  }

  return {
    batch_id: batchID,
    batch_code: asOptionalString(payload.batch_code),
    initial_qty: asOptionalNumber(payload.initial_qty),
    remaining_qty: asOptionalNumber(payload.remaining_qty),
    status: asOptionalString(payload.status),
    unit_cost: asOptionalNumber(payload.unit_cost),
    transaction_id: asOptionalString(payload.transaction_id),
    received_at: asOptionalString(payload.received_at),
  };
}

function parseInventoryBatchCollection(payload: unknown): InventoryBatch[] {
  if (Array.isArray(payload)) {
    return payload
      .map((row) => parseInventoryBatchRow(row))
      .filter((row): row is InventoryBatch => row !== null);
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.items)) {
    return parseInventoryBatchCollection(payload.items);
  }

  if (Array.isArray(payload.batches)) {
    return parseInventoryBatchCollection(payload.batches);
  }

  return [];
}

function parseProcurementLogRow(payload: unknown): ProcurementLog | null {
  if (!isRecord(payload)) {
    return null;
  }

  const action = asOptionalString(payload.action);
  if (!action) {
    return null;
  }

  return {
    action,
    note: asOptionalString(payload.note),
    created_at: asOptionalString(payload.created_at),
  };
}

function parseProcurementLogCollection(payload: unknown): ProcurementLog[] {
  if (Array.isArray(payload)) {
    return payload
      .map((row) => parseProcurementLogRow(row))
      .filter((row): row is ProcurementLog => row !== null);
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.items)) {
    return parseProcurementLogCollection(payload.items);
  }

  if (Array.isArray(payload.logs)) {
    return parseProcurementLogCollection(payload.logs);
  }

  return [];
}

function parseMaterialOptions(payload: unknown): ProcurementMaterialOption[] {
  const rows =
    isRecord(payload) && Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : [];

  const parsed: ProcurementMaterialOption[] = [];

  for (const row of rows) {
    if (!isRecord(row)) {
      continue;
    }

    const itemID = asOptionalString(row.item_id);
    const label = asOptionalString(row.label);
    const category = asOptionalString(row.category);

    if (!itemID || !label) {
      continue;
    }

    if (category && category.toUpperCase() !== "RAW") {
      continue;
    }

    parsed.push({
      item_id: itemID,
      label,
    });
  }

  return parsed.sort((a, b) => a.label.localeCompare(b.label));
}

function parseProcurementDetail(payload: unknown): ProcurementDetail {
  if (!isRecord(payload)) {
    return invalidPayload("detail");
  }

  const lastAction = asOptionalString(payload.last_action);
  const lastActionAt = asOptionalString(payload.last_action_at);
  const lastLogNote = asOptionalString(payload.last_log_note);

  let lastLog: ProcurementLog | undefined;
  if (lastAction) {
    lastLog = {
      action: lastAction,
      note: lastLogNote,
      created_at: lastActionAt,
    };
  }

  const batchItemsFromDetail =
    parseInventoryBatchCollection(payload.batches).length > 0
      ? parseInventoryBatchCollection(payload.batches)
      : parseInventoryBatchCollection(payload.batch_items);

  const rootLogs = parseProcurementLogCollection(payload.logs);
  const nestedLogs = parseProcurementLogCollection(
    isRecord(payload.logs) ? payload.logs : payload.log_items,
  );
  const logItemsFromDetail = rootLogs.length > 0 ? rootLogs : nestedLogs;

  const totalBatches =
    asOptionalNumber(payload.total_batches) ??
    asOptionalNumber(
      isRecord(payload.batches) ? payload.batches.total : undefined,
    ) ??
    batchItemsFromDetail.length;

  const activeBatches =
    asOptionalNumber(payload.active_batches) ??
    asOptionalNumber(
      isRecord(payload.batches) ? payload.batches.active : undefined,
    ) ??
    batchItemsFromDetail.filter((row) => row.status?.toUpperCase() === "ACTIVE")
      .length;

  const reversedBatches =
    asOptionalNumber(payload.reversed_batches) ??
    asOptionalNumber(
      isRecord(payload.batches) ? payload.batches.reversed : undefined,
    ) ??
    batchItemsFromDetail.filter(
      (row) => row.status?.toUpperCase() === "REVERSED",
    ).length;

  const po: PurchaseOrder = {
    id: asRequiredString(payload.id, "id"),
    po_number: asRequiredString(payload.po_number, "po_number"),
    transaction_id: asRequiredString(payload.transaction_id, "transaction_id"),
    vendor_name: asRequiredString(payload.vendor_name, "vendor_name"),
    vendor_code: asOptionalString(payload.vendor_code),
    vendor_short_name: asOptionalString(payload.vendor_short_name),
    vendor_contact_person: asOptionalString(payload.vendor_contact_person),
    vendor_phone: asOptionalString(payload.vendor_phone),
    item_id: asRequiredString(payload.item_id, "item_id"),
    item_name: asRequiredString(payload.item_name, "item_name"),
    item_sku: asOptionalString(payload.item_sku),
    ordered_qty: asRequiredNumber(payload.ordered_qty, "ordered_qty"),
    received_qty: asRequiredNumber(payload.received_qty, "received_qty"),
    unit_price: asRequiredNumber(payload.unit_price, "unit_price"),
    vendor_invoice_ref: asOptionalString(payload.vendor_invoice_ref),
    payment_status: asOptionalPaymentStatus(payload.payment_status),
    total_value: asOptionalNumber(payload.total_value),
    paid_amount: asOptionalNumber(payload.paid_amount),
    due_amount: asOptionalNumber(payload.due_amount),
    notes: asOptionalString(payload.notes),
    status: asStatus(payload.status, "status"),
    created_by: asRequiredString(payload.created_by, "created_by"),
    created_at: asOptionalString(payload.created_at),
    updated_at: asOptionalString(payload.updated_at),
    last_action: lastAction,
    last_action_at: lastActionAt,
    last_log_note: lastLogNote,
    total_batches: totalBatches,
  };

  return {
    po,
    batches: {
      total: totalBatches,
      active: activeBatches,
      reversed: reversedBatches,
      items: batchItemsFromDetail,
    },
    logs: {
      items: logItemsFromDetail,
      last_action: lastLog,
    },
  };
}

function parseCreateResult(payload: unknown): CreatePurchaseOrderResult {
  if (!isRecord(payload)) {
    return invalidPayload("create result");
  }

  return {
    purchase_order_id: asRequiredString(
      payload.purchase_order_id,
      "purchase_order_id",
    ),
    po_number: asRequiredString(payload.po_number, "po_number"),
    transaction_id: asRequiredString(payload.transaction_id, "transaction_id"),
    status: asStatus(payload.status, "status"),
    payment_status: asOptionalPaymentStatus(payload.payment_status),
  };
}

function parseUpdateResult(payload: unknown): UpdatePurchaseOrderResult {
  if (!isRecord(payload)) {
    return invalidPayload("update result");
  }

  return {
    purchase_order_id: asRequiredString(
      payload.purchase_order_id,
      "purchase_order_id",
    ),
    item_id: asRequiredString(payload.item_id, "item_id"),
    ordered_qty: asRequiredNumber(payload.ordered_qty, "ordered_qty"),
    received_qty: asRequiredNumber(payload.received_qty, "received_qty"),
    unit_price: asRequiredNumber(payload.unit_price, "unit_price"),
    vendor_invoice_ref: asOptionalString(payload.vendor_invoice_ref),
    payment_status: asOptionalPaymentStatus(payload.payment_status),
    notes: asOptionalString(payload.notes),
    status: asStatus(payload.status, "status"),
  };
}

function parseReceiveResult(payload: unknown): ReceiveGoodsResult {
  if (!isRecord(payload)) {
    return invalidPayload("receive result");
  }

  return {
    purchase_order_id: asRequiredString(
      payload.purchase_order_id,
      "purchase_order_id",
    ),
    batch_id: asRequiredString(payload.batch_id, "batch_id"),
    batch_code: asRequiredString(payload.batch_code, "batch_code"),
    transaction_id: asRequiredString(payload.transaction_id, "transaction_id"),
    movement_group_id: asRequiredString(
      payload.movement_group_id,
      "movement_group_id",
    ),
    received_qty: asRequiredNumber(payload.received_qty, "received_qty"),
    status: asStatus(payload.status, "status"),
  };
}

function parseReverseResult(payload: unknown): ReverseReceiptResult {
  if (!isRecord(payload)) {
    return invalidPayload("reverse result");
  }

  return {
    purchase_order_id: asRequiredString(
      payload.purchase_order_id,
      "purchase_order_id",
    ),
    batch_id: asOptionalString(payload.batch_id),
    reversed_batch_count: asOptionalNumber(payload.reversed_batch_count),
    received_qty: asRequiredNumber(payload.received_qty, "received_qty"),
    status: asStatus(payload.status, "status"),
  };
}

function parseCloseResult(payload: unknown): CloseOrderResult {
  if (!isRecord(payload)) {
    return invalidPayload("close result");
  }

  return {
    purchase_order_id: asRequiredString(
      payload.purchase_order_id,
      "purchase_order_id",
    ),
    status: asStatus(payload.status, "status"),
  };
}

function normalizeID(id: string): string {
  const normalized = id.trim();
  if (!normalized) {
    return invalidPayload("id");
  }

  return normalized;
}

export async function createPurchaseOrder(
  payload: CreatePurchaseOrderPayload,
): Promise<CreatePurchaseOrderResult> {
  const data = await apiClient<unknown>("/procurement", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return parseCreateResult(data);
}

export async function getProcurementMaterialOptions(): Promise<
  ProcurementMaterialOption[]
> {
  const data = await apiClient<unknown>("/items/selectable", {
    method: "GET",
  });

  return parseMaterialOptions(data);
}

async function getProcurementBatches(id: string): Promise<InventoryBatch[]> {
  const data = await apiClient<unknown>(
    `/procurement/orders/${normalizeID(id)}/batches`,
    {
      method: "GET",
    },
  );

  return parseInventoryBatchCollection(data);
}

export async function getProcurementList(
  params: ProcurementListParams = {},
): Promise<ProcurementList> {
  const query = new URLSearchParams();

  if (typeof params.limit === "number" && Number.isFinite(params.limit)) {
    query.set("limit", String(params.limit));
  }

  if (typeof params.offset === "number" && Number.isFinite(params.offset)) {
    query.set("offset", String(params.offset));
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const data = await apiClient<unknown>(`/procurement${suffix}`, {
    method: "GET",
  });

  if (!Array.isArray(data)) {
    return invalidPayload("list");
  }

  const all = data.map((row) => parsePurchaseOrderListRow(row));

  return {
    pending: all.filter(
      (row) => row.status === "PENDING" || row.status === "PARTIAL",
    ),
    recent: all.filter(
      (row) => row.status === "COMPLETED" || row.status === "CLOSED",
    ),
  };
}

export async function getProcurementDetail(
  id: string,
): Promise<ProcurementDetail> {
  const normalizedID = normalizeID(id);
  const data = await apiClient<unknown>(`/procurement/${normalizedID}`, {
    method: "GET",
  });

  const detail = parseProcurementDetail(data);

  if (detail.batches.items.length === 0 && detail.batches.total > 0) {
    const batches = await getProcurementBatches(normalizedID);
    if (batches.length > 0) {
      detail.batches.items = batches;
      detail.batches.total = Math.max(detail.batches.total, batches.length);
    }
  }

  return detail;
}

export async function updatePurchaseOrder(
  id: string,
  payload: UpdatePurchaseOrderPayload,
): Promise<UpdatePurchaseOrderResult> {
  const data = await apiClient<unknown>(`/procurement/${normalizeID(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return parseUpdateResult(data);
}

export async function receiveGoods(
  id: string,
  payload: ReceiveGoodsPayload,
): Promise<ReceiveGoodsResult> {
  const data = await apiClient<unknown>(
    `/procurement/${normalizeID(id)}/receive`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  return parseReceiveResult(data);
}

export async function reverseReceipt(
  id: string,
  payload: ReverseReceiptPayload,
): Promise<ReverseReceiptResult> {
  const data = await apiClient<unknown>(
    `/procurement/${normalizeID(id)}/reverse`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  return parseReverseResult(data);
}

export async function closeOrder(
  id: string,
  payload: CloseOrderPayload,
): Promise<CloseOrderResult> {
  const data = await apiClient<unknown>(
    `/procurement/${normalizeID(id)}/close`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  return parseCloseResult(data);
}
