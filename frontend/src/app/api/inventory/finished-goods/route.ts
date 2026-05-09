import { NextRequest } from "next/server";
import {
  apiError,
  apiSuccess,
  BackendTimeoutError,
  fetchWithTimeout,
  getBackendBaseUrl,
  getSessionToken,
  isRecord,
  parseJson,
  readMessage,
} from "@/app/api/_shared/http";

type FinishedGoodRow = {
  item_id: string;
  sku: string;
  name: string;
  diameter: number;
  available_qty: number;
  reserved_qty: number;
  status: "OK" | "LOW" | "OUT";
};

type FinishedGoodItem = {
  id: string;
  parent_id?: string;
  sku: string | null;
  name: string;
  category: string;
  base_unit: string;
  specs: Record<string, unknown>;
  specification?: string;
  linked_raw_material_id?: string;
  diameter?: number;
  low_stock_threshold?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

function sanitizeMasterRow(row: unknown): FinishedGoodRow | null {
  if (!isRecord(row)) return null;

  const itemId = typeof row.item_id === "string" ? row.item_id.trim() : "";
  if (!itemId) return null;

  return {
    item_id: itemId,
    sku: typeof row.sku === "string" ? row.sku : "",
    name: typeof row.name === "string" ? row.name : "",
    diameter: typeof row.diameter === "number" ? row.diameter : 0,
    available_qty:
      typeof row.available_qty === "number" ? row.available_qty : 0,
    reserved_qty: typeof row.reserved_qty === "number" ? row.reserved_qty : 0,
    status:
      row.status === "LOW" || row.status === "OUT" ? row.status : "OK",
  };
}

function sanitizeMasterRows(payload: unknown): FinishedGoodRow[] {
  if (!isRecord(payload)) return [];

  const items = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload)
      ? payload
      : [];

  return items
    .map((row: unknown) => sanitizeMasterRow(row))
    .filter((row: FinishedGoodRow | null): row is FinishedGoodRow => row !== null);
}

function sanitizeSingleItem(payload: unknown): FinishedGoodItem | null {
  const raw = isRecord(payload) && isRecord(payload.item) ? payload.item : null;
  if (!raw || typeof raw.id !== "string") {
    return null;
  }

  return {
    id: raw.id,
    parent_id: typeof raw.parent_id === "string" ? raw.parent_id : undefined,
    sku: typeof raw.sku === "string" ? raw.sku : null,
    name: typeof raw.name === "string" ? raw.name : "",
    category: typeof raw.category === "string" ? raw.category : "",
    base_unit: typeof raw.base_unit === "string" ? raw.base_unit : "WEIGHT",
    specs: isRecord(raw.specs) ? raw.specs : {},
    specification:
      typeof raw.specification === "string" ? raw.specification : undefined,
    linked_raw_material_id:
      typeof raw.linked_raw_material_id === "string"
        ? raw.linked_raw_material_id
        : undefined,
    diameter: typeof raw.diameter === "number" ? raw.diameter : undefined,
    low_stock_threshold:
      typeof raw.low_stock_threshold === "number"
        ? raw.low_stock_threshold
        : undefined,
    is_active: Boolean(raw.is_active),
    created_at: typeof raw.created_at === "string" ? raw.created_at : undefined,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : undefined,
  };
}

export async function GET() {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Inventory service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(
      `${backendURL}/api/v1/inventory/finished-goods`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );
  } catch (error) {
    if (error instanceof BackendTimeoutError) {
      return apiError("Inventory backend timeout", 504);
    }

    return apiError("Inventory service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to load finished goods"),
      backendResponse.status,
    );
  }

  return apiSuccess("Finished goods loaded", {
    items: sanitizeMasterRows(payload),
  });
}

export async function POST(request: NextRequest) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Inventory service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON payload", 400);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(
      `${backendURL}/api/v1/inventory/finished-goods`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      },
    );
  } catch (error) {
    if (error instanceof BackendTimeoutError) {
      return apiError("Inventory backend timeout", 504);
    }

    return apiError("Inventory service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to create finished good"),
      backendResponse.status,
    );
  }

  return apiSuccess(
    "Finished good created",
    { item: sanitizeSingleItem(payload) },
    backendResponse.status || 201,
  );
}
