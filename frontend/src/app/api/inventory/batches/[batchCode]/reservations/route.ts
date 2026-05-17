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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchCode: string }> },
) {
  const { batchCode: code } = await params;
  const batchCode = code?.trim();

  if (!batchCode) {
    return apiError("Batch code is required", 400);
  }

  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Inventory service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${backendURL}/api/v1/inventory/batches/${encodeURIComponent(batchCode)}/reservations`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );
  } catch (error) {
    return error instanceof BackendTimeoutError
      ? apiError("Inventory backend timeout", 504)
      : apiError("Inventory service unavailable", 503);
  }

  const payload = await parseJson(response);
  if (!response.ok) {
    return apiError(
      readMessage(payload, "Failed to load batch reservations"),
      response.status,
      unwrapBackendPayload(payload),
    );
  }

  return apiSuccess("Batch reservations loaded", unwrapBackendPayload(payload));
}
