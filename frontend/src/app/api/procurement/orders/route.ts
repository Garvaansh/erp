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

type ProcurementOrderDTO = {
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

function sanitizeOrders(payload: unknown): ProcurementOrderDTO[] {
  const rows = unwrapBackendPayload(payload);
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter(
      (row): row is Record<string, unknown> =>
        isRecord(row) &&
        typeof row.id === "string" &&
        typeof row.po_number === "string",
    )
    .map((row) => ({
      id: row.id as string,
      po_number: row.po_number as string,
      supplier_name:
        typeof row.supplier_name === "string"
          ? row.supplier_name
          : typeof row.vendor_name === "string"
            ? row.vendor_name
            : "",
      item_name: typeof row.item_name === "string" ? row.item_name : undefined,
      item_sku:
        typeof row.item_sku === "string"
          ? row.item_sku
          : typeof row.sku === "string"
            ? row.sku
            : undefined,
      ordered_qty: toNumber(row.ordered_qty),
      received_qty: toNumber(row.received_qty),
      unit_price: toNumber(row.unit_price),
      status: typeof row.status === "string" ? row.status : "PENDING",
      created_at:
        typeof row.created_at === "string" ? row.created_at : undefined,
    }));
}

export async function GET() {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Procurement service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(
      `${backendURL}/api/v1/procurement/orders`,
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
      readMessage(payload, "Failed to fetch purchase orders"),
      backendResponse.status,
    );
  }

  return apiSuccess("Procurement orders fetched", {
    orders: sanitizeOrders(payload),
  });
}

export async function POST(request: Request) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Procurement service unavailable", 500);
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
      `${backendURL}/api/v1/procurement/orders`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
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
      readMessage(payload, "Failed to create purchase order"),
      backendResponse.status,
      unwrapBackendPayload(payload),
    );
  }

  return apiSuccess(
    readMessage(payload, "Purchase order created"),
    unwrapBackendPayload(payload),
    backendResponse.status || 201,
  );
}
