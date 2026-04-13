import {
  apiError, apiSuccess, BackendTimeoutError, fetchWithTimeout,
  getBackendBaseUrl, getSessionToken, isRecord, parseJson, readMessage,
} from "@/app/api/_shared/http";

export async function GET() {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) return apiError("Inventory service unavailable", 500);
  const token = await getSessionToken();
  if (!token) return apiError("Unauthorized", 401);

  let res: Response;
  try {
    res = await fetchWithTimeout(`${backendURL}/api/v1/inventory/alerts`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    return e instanceof BackendTimeoutError
      ? apiError("Inventory backend timeout", 504)
      : apiError("Inventory service unavailable", 503);
  }

  const payload = await parseJson(res);
  if (!res.ok) return apiError(readMessage(payload, "Failed to load alerts"), res.status);
  const data = isRecord(payload) && Array.isArray((payload as Record<string, unknown>).data)
    ? (payload as Record<string, unknown>).data : [];
  return apiSuccess("Alerts loaded", data, 200);
}
