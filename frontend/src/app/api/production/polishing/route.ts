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

export async function POST(request: Request) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Production service unavailable", 500);
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

  const idempotencyKey =
    request.headers.get("Idempotency-Key")?.trim() || crypto.randomUUID();

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(
      `${backendURL}/api/v1/production/polishing`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idempotencyKey,
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
      readMessage(payload, "Failed to submit polishing"),
      backendResponse.status,
      unwrapBackendPayload(payload),
    );
  }

  const result = sanitizeWIPSubmission(payload);
  if (!result) {
    return apiError("Malformed polishing response", 502);
  }

  return apiSuccess(
    result.requires_approval
      ? "Sent for approval. Stock reserved"
      : "Polishing submitted",
    result,
    backendResponse.status || 200,
  );
}
