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

type RawMaterialRow = {
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

function sanitizeRow(row: unknown): RawMaterialRow | null {
  if (!isRecord(row)) return null;

  const itemId = typeof row.item_id === "string" ? row.item_id.trim() : "";
  if (!itemId) return null;

  return {
    item_id: itemId,
    sku: typeof row.sku === "string" ? row.sku : "",
    name: typeof row.name === "string" ? row.name : "",
    specification:
      typeof row.specification === "string" ? row.specification : "",
    specs: isRecord(row.specs) ? row.specs : {},
    available_qty:
      typeof row.available_qty === "number" ? row.available_qty : 0,
    reserved_qty:
      typeof row.reserved_qty === "number" ? row.reserved_qty : 0,
    threshold: typeof row.threshold === "number" ? row.threshold : 0,
    pending_deliveries:
      typeof row.pending_deliveries === "number" ? row.pending_deliveries : 0,
    status: row.status === "LOW" ? "LOW" : "OK",
  };
}

function sanitizeRows(payload: unknown): RawMaterialRow[] {
  if (!isRecord(payload)) return [];

  const items = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload)
      ? payload
      : [];

  return items
    .map((row: unknown) => sanitizeRow(row))
    .filter((row: RawMaterialRow | null): row is RawMaterialRow => row !== null);
}

/**
 * GET /api/inventory/raw-materials
 *
 * Returns the raw material master list with aggregated stock and threshold status.
 * Proxies GET /api/v1/inventory/raw-materials on the Go backend.
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
      `${backendURL}/api/v1/inventory/raw-materials`,
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
      readMessage(payload, "Failed to load raw materials"),
      backendResponse.status,
    );
  }

  return apiSuccess(
    "Raw materials loaded",
    { items: sanitizeRows(payload) },
    200,
  );
}
