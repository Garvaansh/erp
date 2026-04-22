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
  if (!backendURL) return apiError("Vendor service unavailable", 500);
  const token = await getSessionToken();
  if (!token) return apiError("Unauthorized", 401);

  const requestURL = new URL(request.url);
  const search = requestURL.search || "";

  let res: Response;
  try {
    res = await fetchWithTimeout(`${backendURL}/api/v1/vendors${search}`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    return e instanceof BackendTimeoutError
      ? apiError("Vendor backend timeout", 504)
      : apiError("Vendor service unavailable", 503);
  }

  const payload = await parseJson(res);
  if (!res.ok) return apiError(readMessage(payload, "Failed to load vendors"), res.status);
  const data = unwrapBackendPayload(payload);
  return apiSuccess("Vendors loaded", data, 200);
}

export async function POST(request: Request) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) return apiError("Vendor service unavailable", 500);
  const token = await getSessionToken();
  if (!token) return apiError("Unauthorized", 401);

  let body: string;
  try { body = JSON.stringify(await request.json()); }
  catch { return apiError("Invalid JSON", 400); }

  let res: Response;
  try {
    res = await fetchWithTimeout(`${backendURL}/api/v1/vendors/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
      body,
    });
  } catch (e) {
    return e instanceof BackendTimeoutError
      ? apiError("Vendor backend timeout", 504)
      : apiError("Vendor service unavailable", 503);
  }

  const payload = await parseJson(res);
  if (!res.ok) return apiError(readMessage(payload, "Failed to create vendor"), res.status);
  const data = unwrapBackendPayload(payload);
  return apiSuccess("Vendor created", data, 201);
}
