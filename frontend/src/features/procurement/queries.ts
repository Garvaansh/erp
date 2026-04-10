import { apiClient } from "@/lib/api-client";
import type {
  ProcurementBatch,
  ProcurementMaterialOption,
  ProcurementOrderDetails,
  ProcurementOrderListItem,
} from "@/features/procurement/types";

type ProcurementOrdersResponse = {
  orders?: unknown;
};

type ProcurementOrderDetailsResponse = {
  order?: unknown;
};

type ProcurementBatchesResponse = {
  batches?: unknown;
};

type SelectableItemsResponse = {
  items?: unknown;
};

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toDate(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function sanitizeOrder(row: unknown): ProcurementOrderListItem | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const value = row as Record<string, unknown>;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const poNumber =
    typeof value.po_number === "string" ? value.po_number.trim() : "";

  if (!id || !poNumber) {
    return null;
  }

  const orderedQty = toNumber(value.ordered_qty);
  const receivedQty = toNumber(value.received_qty);
  const remainingQty = Math.max(orderedQty - receivedQty, 0);

  const statusRaw =
    typeof value.status === "string" ? value.status.trim().toUpperCase() : "";
  const status =
    statusRaw === "DELIVERED" || statusRaw === "CANCELLED"
      ? statusRaw
      : "PENDING";

  return {
    id,
    po_number: poNumber,
    supplier_name:
      typeof value.supplier_name === "string"
        ? value.supplier_name.trim()
        : typeof value.vendor_name === "string"
          ? value.vendor_name.trim()
          : "",
    item_name:
      typeof value.item_name === "string" ? value.item_name.trim() : undefined,
    item_sku:
      typeof value.item_sku === "string"
        ? value.item_sku.trim()
        : typeof value.sku === "string"
          ? value.sku.trim()
          : undefined,
    ordered_qty: orderedQty,
    received_qty: receivedQty,
    remaining_qty: remainingQty,
    unit_price: toNumber(value.unit_price),
    status,
    created_at: toDate(value.created_at),
  };
}

function sanitizeBatch(row: unknown): ProcurementBatch | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const value = row as Record<string, unknown>;
  const batchID =
    typeof value.batch_id === "string" ? value.batch_id.trim() : "";
  const batchCode =
    typeof value.batch_code === "string" ? value.batch_code.trim() : "";

  if (!batchID || !batchCode) {
    return null;
  }

  return {
    batch_id: batchID,
    batch_code: batchCode,
    initial_qty: toNumber(value.initial_qty),
    remaining_qty: toNumber(value.remaining_qty),
    transaction_id:
      typeof value.transaction_id === "string"
        ? value.transaction_id.trim()
        : undefined,
    received_at: toDate(value.received_at),
  };
}

export async function getProcurementOrders(): Promise<
  ProcurementOrderListItem[]
> {
  const data = await apiClient<ProcurementOrdersResponse>(
    "/procurement/orders",
    {
      method: "GET",
    },
  );

  const rows = Array.isArray(data.orders) ? data.orders : [];

  return rows
    .map((row) => sanitizeOrder(row))
    .filter((row): row is ProcurementOrderListItem => row !== null)
    .sort(
      (a, b) =>
        (b.created_at ?? "").localeCompare(a.created_at ?? "") ||
        a.po_number.localeCompare(b.po_number),
    );
}

export async function getProcurementOrderDetails(
  poId: string,
): Promise<ProcurementOrderDetails> {
  const normalizedID = poId.trim();

  const [orderResponse, batchResponse] = await Promise.all([
    apiClient<ProcurementOrderDetailsResponse>(
      `/procurement/orders/${normalizedID}`,
      {
        method: "GET",
      },
    ),
    apiClient<ProcurementBatchesResponse>(
      `/procurement/orders/${normalizedID}/batches`,
      {
        method: "GET",
      },
    ),
  ]);

  const order = sanitizeOrder(orderResponse.order);
  if (!order) {
    throw new Error("Unable to load procurement order details.");
  }

  const batches = (
    Array.isArray(batchResponse.batches) ? batchResponse.batches : []
  )
    .map((row) => sanitizeBatch(row))
    .filter((row): row is ProcurementBatch => row !== null)
    .sort((a, b) => (b.received_at ?? "").localeCompare(a.received_at ?? ""));

  const receivedFromBatches = batches.reduce(
    (sum, batch) => sum + batch.initial_qty,
    0,
  );

  return {
    order: {
      ...order,
      received_qty: Math.max(order.received_qty, receivedFromBatches),
      remaining_qty: Math.max(order.ordered_qty - receivedFromBatches, 0),
    },
    batches,
  };
}

export async function getProcurementMaterialOptions(): Promise<
  ProcurementMaterialOption[]
> {
  const data = await apiClient<SelectableItemsResponse>("/items/selectable", {
    method: "GET",
  });

  const items = Array.isArray(data.items) ? data.items : [];
  return items
    .filter(
      (item): item is { item_id: string; label: string; category?: string } =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).item_id === "string" &&
        typeof (item as Record<string, unknown>).label === "string" &&
        (((item as Record<string, unknown>).category as string | undefined) ??
          "RAW") === "RAW",
    )
    .map((item) => ({ item_id: item.item_id, label: item.label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
