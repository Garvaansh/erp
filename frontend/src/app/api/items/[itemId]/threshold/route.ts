import { NextRequest } from "next/server";
import {
  apiError,
  apiSuccess,
  BackendTimeoutError,
  fetchWithTimeout,
  getBackendBaseUrl,
  getSessionToken,
  parseJson,
  readMessage,
} from "@/app/api/_shared/http";

/**
 * PATCH /api/items/[itemId]/threshold
 *
 * Updates the low stock threshold for an item.
 * Proxies PATCH /api/v1/items/:id/threshold on the Go backend.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const trimmedId = itemId?.trim();
  if (!trimmedId) {
    return apiError("Item ID is required", 400);
  }

  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Items service unavailable", 500);
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
      `${backendURL}/api/v1/items/${encodeURIComponent(trimmedId)}/threshold`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      },
    );
  } catch (error) {
    if (error instanceof BackendTimeoutError) {
      return apiError("Items backend timeout", 504);
    }

    return apiError("Items service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to update threshold"),
      backendResponse.status,
    );
  }

  return apiSuccess("Threshold updated", payload, 200);
}
