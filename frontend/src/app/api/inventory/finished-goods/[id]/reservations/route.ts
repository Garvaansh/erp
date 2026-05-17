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
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: itemId } = await params;
  const normalizedId = itemId?.trim();

  if (!normalizedId) {
    return apiError("Finished good ID is required", 400);
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
      `${backendURL}/api/v1/inventory/finished-goods/${encodeURIComponent(normalizedId)}/reservations`,
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
      readMessage(payload, "Failed to load reservation visibility"),
      response.status,
      unwrapBackendPayload(payload),
    );
  }

  return apiSuccess("Finished good reservations loaded", unwrapBackendPayload(payload));
}
