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

type RawMaterialSummary = {
  item_id: string;
  sku: string;
  name: string;
  specification: string;
  specs: Record<string, unknown>;
  available_qty: number;
  reserved_qty: number;
  hold_qty: number;
  pending_deliveries: number;
  threshold: number;
};

function sanitizeSummary(payload: unknown): RawMaterialSummary | null {
  if (!isRecord(payload)) return null;

  const itemId = typeof payload.item_id === "string" ? payload.item_id.trim() : "";
  if (!itemId) return null;

  return {
    item_id: itemId,
    sku: typeof payload.sku === "string" ? payload.sku : "",
    name: typeof payload.name === "string" ? payload.name : "",
    specification:
      typeof payload.specification === "string" ? payload.specification : "",
    specs: isRecord(payload.specs) ? payload.specs : {},
    available_qty:
      typeof payload.available_qty === "number" ? payload.available_qty : 0,
    reserved_qty:
      typeof payload.reserved_qty === "number" ? payload.reserved_qty : 0,
    hold_qty: typeof payload.hold_qty === "number" ? payload.hold_qty : 0,
    pending_deliveries:
      typeof payload.pending_deliveries === "number"
        ? payload.pending_deliveries
        : 0,
    threshold: typeof payload.threshold === "number" ? payload.threshold : 0,
  };
}

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
      `${backendURL}/api/v1/inventory/raw-materials/${encodeURIComponent(trimmedId)}/summary`,
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
      readMessage(payload, "Failed to load raw material summary"),
      backendResponse.status,
    );
  }

  const summary = sanitizeSummary(payload);
  if (!summary) {
    return apiError("Malformed raw material summary response", 502);
  }

  return apiSuccess("Raw material summary loaded", summary, 200);
}
