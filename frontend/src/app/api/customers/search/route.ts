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

export async function GET(request: Request) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Customer service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  const requestURL = new URL(request.url);
  const search = requestURL.search || "";

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${backendURL}/api/v1/customers/search${search}`,
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
      ? apiError("Customer backend timeout", 504)
      : apiError("Customer service unavailable", 503);
  }

  const payload = await parseJson(response);
  if (!response.ok) {
    return apiError(
      readMessage(payload, "Failed to search customers"),
      response.status,
      unwrapBackendPayload(payload),
    );
  }

  return apiSuccess("Customers loaded", unwrapBackendPayload(payload));
}
