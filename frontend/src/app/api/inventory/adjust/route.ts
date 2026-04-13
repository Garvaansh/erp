import {
  apiError, apiSuccess, BackendTimeoutError, fetchWithTimeout,
  getBackendBaseUrl, getSessionToken, parseJson, readMessage,
} from "@/app/api/_shared/http";

export async function POST(request: Request) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) return apiError("Inventory service unavailable", 500);
  const token = await getSessionToken();
  if (!token) return apiError("Unauthorized", 401);

  let body: string;
  try { body = JSON.stringify(await request.json()); }
  catch { return apiError("Invalid JSON", 400); }

  let res: Response;
  try {
    res = await fetchWithTimeout(`${backendURL}/api/v1/inventory/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
      body,
    });
  } catch (e) {
    return e instanceof BackendTimeoutError
      ? apiError("Inventory backend timeout", 504)
      : apiError("Inventory service unavailable", 503);
  }

  const payload = await parseJson(res);
  if (!res.ok) return apiError(readMessage(payload, "Stock adjustment failed"), res.status);
  return apiSuccess("Stock adjusted", null, 200);
}
