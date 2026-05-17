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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const orderId = id?.trim();

  if (!orderId) {
    return apiError("Order ID is required", 400);
  }

  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Orders service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return apiError("Invalid request body", 400);
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${backendURL}/api/v1/orders/${encodeURIComponent(orderId)}/cancel`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body,
      },
    );
  } catch (error) {
    return error instanceof BackendTimeoutError
      ? apiError("Orders backend timeout", 504)
      : apiError("Orders service unavailable", 503);
  }

  const payload = await parseJson(response);
  if (!response.ok) {
    return apiError(
      readMessage(payload, "Failed to cancel order"),
      response.status,
      unwrapBackendPayload(payload),
    );
  }

  return apiSuccess("Order cancelled", unwrapBackendPayload(payload));
}
