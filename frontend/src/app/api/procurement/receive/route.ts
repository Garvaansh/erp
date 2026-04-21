import {
  apiError,
  apiSuccess,
  BackendTimeoutError,
  fetchWithTimeout,
  getBackendBaseUrl,
  getSessionToken,
  parseJson,
  readMessage,
  unwrapBackendPayload,
} from "@/app/api/_shared/http";

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

  if (typeof body !== "object" || body === null) {
    return apiError("Invalid JSON payload", 400);
  }

  const requestPayload = body as Record<string, unknown>;
  const poId =
    typeof requestPayload.po_id === "string" ? requestPayload.po_id.trim() : "";
  const qtyValue =
    typeof requestPayload.qty === "number"
      ? requestPayload.qty
      : typeof requestPayload.actual_weight_received === "number"
        ? requestPayload.actual_weight_received
        : typeof requestPayload.actual_weight === "number"
          ? requestPayload.actual_weight
          : Number.NaN;

  if (!poId) {
    return apiError("Invalid purchase order reference", 400);
  }

  if (!Number.isFinite(qtyValue) || qtyValue <= 0) {
    return apiError("Invalid receipt quantity", 400);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(
      `${backendURL}/api/v1/procurement/${encodeURIComponent(poId)}/receive`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ qty: qtyValue }),
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
      readMessage(payload, "Failed to receive stock"),
      backendResponse.status,
      unwrapBackendPayload(payload),
    );
  }

  return apiSuccess(
    readMessage(payload, "Purchase order received"),
    unwrapBackendPayload(payload),
    backendResponse.status || 200,
  );
}
