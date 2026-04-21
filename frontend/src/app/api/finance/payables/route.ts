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

export async function GET() {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Finance service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(
      `${backendURL}/api/v1/finance/payables`,
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
      return apiError("Finance backend timeout", 504);
    }

    return apiError("Finance service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);

  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to fetch payables"),
      backendResponse.status,
      unwrapBackendPayload(payload),
    );
  }

  const data = unwrapBackendPayload(payload);

  return apiSuccess(
    readMessage(payload, "Payables fetched"),
    Array.isArray(data) ? data : [],
    200,
  );
}
