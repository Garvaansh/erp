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
  context: { params: Promise<{ id: string }> },
) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Procurement service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return apiError("Invalid procurement reference", 400);
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
      `${backendURL}/api/v1/procurement/${encodeURIComponent(id)}/reverse`,
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
      readMessage(payload, "Failed to reverse receipt"),
      backendResponse.status,
      unwrapBackendPayload(payload),
    );
  }

  return apiSuccess(
    readMessage(payload, "Receipt reversed"),
    unwrapBackendPayload(payload),
  );
}
