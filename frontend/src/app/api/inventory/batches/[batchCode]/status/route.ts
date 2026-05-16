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
 * PATCH /api/inventory/batches/[batchId]/status
 *
 * Toggles batch status between HOLD and ACTIVE.
 * Proxies PATCH /api/v1/inventory/batches/:id/status on the Go backend.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ batchCode: string }> },
) {
  const { batchCode } = await params;
  const trimmedId = batchCode?.trim();
  if (!trimmedId) {
    return apiError("Batch ID is required", 400);
  }

  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Inventory service unavailable", 500);
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
      `${backendURL}/api/v1/inventory/batches/${encodeURIComponent(trimmedId)}/status`,
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
      return apiError("Inventory backend timeout", 504);
    }

    return apiError("Inventory service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to update batch status"),
      backendResponse.status,
    );
  }

  return apiSuccess("Batch status updated", payload, 200);
}
