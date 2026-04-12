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

/**
 * A single inventory row for one item within a category.
 * The BFF reshapes the Go backend's view rows to a UI-friendly format.
 */
type InventoryViewRow = {
  item_id: string;
  sku?: string;
  name: string;
  specs: Record<string, unknown>;
  total_qty: number;
  available_qty: number;
  reserved_qty: number;
};

/**
 * The UX-shaped inventory snapshot returned to the frontend.
 * Maps to the four ledger zones of the factory floor.
 */
type InventoryView = {
  RAW: InventoryViewRow[];
  SEMI_FINISHED: InventoryViewRow[];
  FINISHED: InventoryViewRow[];
  SCRAP: InventoryViewRow[];
};

const EMPTY_VIEW: InventoryView = {
  RAW: [],
  SEMI_FINISHED: [],
  FINISHED: [],
  SCRAP: [],
};

function sanitizeViewRow(row: unknown): InventoryViewRow | null {
  if (!isRecord(row)) return null;

  const itemId = typeof row.item_id === "string" ? row.item_id.trim() : "";
  const sku = typeof row.sku === "string" ? row.sku.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const totalQty = typeof row.total_qty === "number" ? row.total_qty : 0;
  const availableQty =
    typeof row.available_qty === "number" ? row.available_qty : totalQty;
  const reservedQty =
    typeof row.reserved_qty === "number" ? row.reserved_qty : 0;
  const specs = isRecord(row.specs) ? row.specs : {};

  if (!itemId) return null;

  return {
    item_id: itemId,
    sku: sku || undefined,
    name,
    specs,
    total_qty: totalQty,
    available_qty: availableQty,
    reserved_qty: reservedQty,
  };
}

function sanitizeCategory(data: unknown): InventoryViewRow[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((row) => sanitizeViewRow(row))
    .filter((row): row is InventoryViewRow => row !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function sanitizeView(payload: unknown): InventoryView {
  if (!isRecord(payload)) return EMPTY_VIEW;

  return {
    RAW: sanitizeCategory(payload.RAW),
    SEMI_FINISHED: sanitizeCategory(payload.SEMI_FINISHED),
    FINISHED: sanitizeCategory(payload.FINISHED),
    SCRAP: sanitizeCategory(payload.SCRAP),
  };
}

/**
 * GET /api/inventory/view
 *
 * Returns the full multi-category inventory snapshot aggregated by item.
 * Proxies GET /api/v1/inventory/view on the Go backend.
 * This single call replaces the expensive 4-way fan-out that was previously
 * hitting /api/v1/items?category=X four times.
 */
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
      `${backendURL}/api/v1/inventory/view`,
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
      readMessage(payload, "Failed to load inventory view"),
      backendResponse.status,
    );
  }

  return apiSuccess("Inventory view loaded", sanitizeView(payload), 200);
}
