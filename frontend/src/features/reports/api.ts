import { apiClient } from "@/lib/api/api-client";
import type {
  ReportFilters,
  ReportResponse,
  ReportRow,
  ReportType,
} from "./types";

type PurchaseReportPayload = {
  rows?: Array<{
    date?: string;
    purchase_order_id?: string;
    po_number?: string;
    vendor_name?: string;
    item_name?: string;
    quantity_received?: number;
    unit_cost?: number;
    total_value?: number;
    payment_status?: string;
    status?: string;
  }>;
  total_orders?: number;
  total_pending?: number;
  total_value?: number;
};

type InventoryReportPayload = {
  stock_on_hand?: Array<{
    item_id?: string;
    sku?: string;
    name?: string;
    category?: string;
    total_qty?: number;
    available_qty?: number;
    reserved_qty?: number;
    min_qty?: number;
    max_qty?: number;
    is_low_stock?: boolean;
    batch_count?: number;
  }>;
  total_items?: number;
  low_stock_count?: number;
  total_stock_qty?: number;
};

function toQueryString(filters: ReportFilters): string {
  const params = new URLSearchParams();
  params.set("from", filters.from);
  params.set("to", filters.to);
  return params.toString();
}

function numberOrZero(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function stringOrDash(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return "-";
}

export const getInventoryReport = async (
  filters: ReportFilters,
): Promise<ReportResponse> => {
  const query = toQueryString(filters);
  const data = await apiClient<InventoryReportPayload>(
    `/reports/inventory?${query}`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const rows: ReportRow[] = (data.stock_on_hand ?? []).map((row) => ({
    item_id: stringOrDash(row.item_id),
    sku: stringOrDash(row.sku),
    name: stringOrDash(row.name),
    category: stringOrDash(row.category),
    total_qty: numberOrZero(row.total_qty),
    available_qty: numberOrZero(row.available_qty),
    reserved_qty: numberOrZero(row.reserved_qty),
    min_qty: numberOrZero(row.min_qty),
    max_qty: numberOrZero(row.max_qty),
    batch_count: numberOrZero(row.batch_count),
    is_low_stock: row.is_low_stock ? "Yes" : "No",
  }));

  return {
    summary: {
      total_items: numberOrZero(data.total_items),
      low_stock_count: numberOrZero(data.low_stock_count),
      total_stock_qty: numberOrZero(data.total_stock_qty),
    },
    rows,
  };
};

export const getPurchaseReport = async (
  filters: ReportFilters,
): Promise<ReportResponse> => {
  const query = toQueryString(filters);
  const data = await apiClient<PurchaseReportPayload>(
    `/reports/purchase?${query}`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const rows: ReportRow[] = (data.rows ?? []).map((row) => ({
    date: stringOrDash(row.date),
    transaction_ref: stringOrDash(row.po_number || row.purchase_order_id),
    vendor_name: stringOrDash(row.vendor_name),
    item: stringOrDash(row.item_name),
    sku: "-",
    quantity: numberOrZero(row.quantity_received),
    unit_cost: numberOrZero(row.unit_cost),
    total_value: numberOrZero(row.total_value),
    payment_status: stringOrDash(row.payment_status),
    status: stringOrDash(row.status),
  }));

  return {
    summary: {
      total_orders: numberOrZero(data.total_orders),
      total_pending: numberOrZero(data.total_pending),
      total_value: numberOrZero(data.total_value),
      records: rows.length,
    },
    rows,
  };
};

export const getSalesReport = async (
  _filters: ReportFilters,
): Promise<ReportResponse> => {
  return {
    summary: {
      records: 0,
    },
    rows: [],
  };
};

const reportFetchers: Record<
  ReportType,
  (filters: ReportFilters) => Promise<ReportResponse>
> = {
  inventory: getInventoryReport,
  purchase: getPurchaseReport,
  sales: getSalesReport,
};

export const getReportByType = async (
  type: ReportType,
  filters: ReportFilters,
): Promise<ReportResponse> => {
  return reportFetchers[type](filters);
};
