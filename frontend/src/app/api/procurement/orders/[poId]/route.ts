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
  unwrapBackendPayload,
} from "@/app/api/_shared/http";

type ProcurementOrderDetailsDTO = {
  id: string;
  po_number: string;
  supplier_name: string;
  item_name?: string;
  item_sku?: string;
  ordered_qty: number;
  received_qty: number;
  unit_price: number;
  status: string;
  created_at?: string;
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

function sanitizeOrder(payload: unknown): ProcurementOrderDetailsDTO | null {
  const value = unwrapBackendPayload(payload);
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  return {
    id: value.id,
    po_number: typeof value.po_number === "string" ? value.po_number : "",
    supplier_name:
      typeof value.supplier_name === "string"
        ? value.supplier_name
        : typeof value.vendor_name === "string"
          ? value.vendor_name
          : "",
    item_name:
      typeof value.item_name === "string" ? value.item_name : undefined,
    item_sku:
      typeof value.item_sku === "string"
        ? value.item_sku
        : typeof value.sku === "string"
          ? value.sku
          : undefined,
    ordered_qty: toNumber(value.ordered_qty),
    received_qty: toNumber(value.received_qty),
    unit_price: toNumber(value.unit_price),
    status: typeof value.status === "string" ? value.status : "PENDING",
    created_at:
      typeof value.created_at === "string" ? value.created_at : undefined,
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ poId: string }> },
) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Procurement service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  const { poId } = await context.params;
  if (!poId?.trim()) {
    return apiError("Invalid purchase order reference", 400);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(
      `${backendURL}/api/v1/procurement/orders/${encodeURIComponent(poId)}`,
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
      return apiError("Procurement backend timeout", 504);
    }

    return apiError("Procurement service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to fetch purchase order details"),
      backendResponse.status,
    );
  }

  const order = sanitizeOrder(payload);
  if (!order) {
    return apiError("Malformed purchase order details response", 502);
  }

  return apiSuccess("Procurement order details fetched", { order });
}
