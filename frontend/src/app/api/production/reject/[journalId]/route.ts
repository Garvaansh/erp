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
import { sanitizeWIPSubmission } from "@/app/api/production/_shared";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ journalId: string }> },
) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Production service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  const { journalId } = await context.params;
  if (!journalId?.trim()) {
    return apiError("Invalid journal id", 400);
  }

  let body: unknown = {};
  if ((request.headers.get("content-length") ?? "").trim() !== "0") {
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON payload", 400);
    }
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(
      `${backendURL}/api/v1/production/reject/${encodeURIComponent(journalId)}`,
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
      return apiError("Production backend timeout", 504);
    }

    return apiError("Production service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to reject journal"),
      backendResponse.status,
      unwrapBackendPayload(payload),
    );
  }

  const result = sanitizeWIPSubmission(payload);
  if (!result) {
    return apiError("Malformed rejection response", 502);
  }

  return apiSuccess("Journal rejected", result, 200);
}
