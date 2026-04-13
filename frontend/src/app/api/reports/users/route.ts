import {
  apiError, apiSuccess, BackendTimeoutError, fetchWithTimeout,
  getBackendBaseUrl, getSessionToken, parseJson, readMessage,
  unwrapBackendPayload,
} from "@/app/api/_shared/http";

export async function GET() {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) return apiError("Reports service unavailable", 500);
  const token = await getSessionToken();
  if (!token) return apiError("Unauthorized", 401);

  let res: Response;
  try {
    res = await fetchWithTimeout(`${backendURL}/api/v1/reports/users`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    return e instanceof BackendTimeoutError
      ? apiError("Reports backend timeout", 504)
      : apiError("Reports service unavailable", 503);
  }

  const payload = await parseJson(res);
  if (!res.ok) return apiError(readMessage(payload, "Failed to load users report"), res.status);
  const data = unwrapBackendPayload(payload);
  return apiSuccess("Users report loaded", data, 200);
}
