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

export async function POST(request: Request) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Customer service unavailable", 500);
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
    response = await fetchWithTimeout(`${backendURL}/api/v1/customers`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
    });
  } catch (error) {
    return error instanceof BackendTimeoutError
      ? apiError("Customer backend timeout", 504)
      : apiError("Customer service unavailable", 503);
  }

  const payload = await parseJson(response);
  if (!response.ok) {
    return apiError(
      readMessage(payload, "Failed to create customer"),
      response.status,
      unwrapBackendPayload(payload),
    );
  }

  const status = response.status === 200 ? 200 : 201;
  return apiSuccess("Customer created", unwrapBackendPayload(payload), status);
}
