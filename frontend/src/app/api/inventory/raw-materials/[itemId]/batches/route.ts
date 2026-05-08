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

type BatchRow = {
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
  status: string;
};

function sanitizeBatch(row: unknown): BatchRow | null {
  if (!isRecord(row)) return null;

  const batchId = typeof row.batch_id === "string" ? row.batch_id.trim() : "";
  if (!batchId) return null;

  return {
    batch_id: batchId,
    batch_code: typeof row.batch_code === "string" ? row.batch_code : "",
    vendor_name:
      typeof row.vendor_name === "string" ? row.vendor_name : undefined,
    po_number: typeof row.po_number === "string" ? row.po_number : undefined,
    parent_po_id:
      typeof row.parent_po_id === "string" ? row.parent_po_id : undefined,
    received_at: typeof row.received_at === "string" ? row.received_at : "",
    initial_qty: typeof row.initial_qty === "number" ? row.initial_qty : 0,
    remaining_qty:
      typeof row.remaining_qty === "number" ? row.remaining_qty : 0,
    reserved_qty:
      typeof row.reserved_qty === "number" ? row.reserved_qty : 0,
    available_qty:
      typeof row.available_qty === "number" ? row.available_qty : 0,
    status: typeof row.status === "string" ? row.status : "ACTIVE",
  };
}

function sanitizeBatches(payload: unknown): BatchRow[] {
  if (!isRecord(payload)) return [];

  const batches = Array.isArray(payload.batches)
    ? payload.batches
    : Array.isArray(payload)
      ? payload
      : [];

  return batches
    .map((row: unknown) => sanitizeBatch(row))
    .filter((row: BatchRow | null): row is BatchRow => row !== null);
}

/**
 * GET /api/inventory/raw-materials/[itemId]/batches
 *
 * Returns batch drill-down for a specific raw material item.
 * Proxies GET /api/v1/inventory/raw-materials/:id/batches on the Go backend.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const trimmedId = itemId?.trim();
  if (!trimmedId) {
    return apiError("Item ID is required", 400);
  }

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
      `${backendURL}/api/v1/inventory/raw-materials/${encodeURIComponent(trimmedId)}/batches`,
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
      readMessage(payload, "Failed to load batches"),
      backendResponse.status,
    );
  }

  return apiSuccess(
    "Batches loaded",
    { batches: sanitizeBatches(payload) },
    200,
  );
}
