import {
  apiError, apiSuccess, BackendTimeoutError, fetchWithTimeout,
  getBackendBaseUrl, getSessionToken, parseJson, readMessage,
} from "@/app/api/_shared/http";

export async function PUT(request: Request, { params }: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = await params;
  const backendURL = getBackendBaseUrl();
  if (!backendURL) return apiError("Vendor service unavailable", 500);
  const token = await getSessionToken();
  if (!token) return apiError("Unauthorized", 401);

  let body: string;
  try { body = JSON.stringify(await request.json()); }
  catch { return apiError("Invalid JSON", 400); }

  let res: Response;
  try {
    res = await fetchWithTimeout(`${backendURL}/api/v1/vendors/${vendorId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
      body,
    });
  } catch (e) {
    return e instanceof BackendTimeoutError
      ? apiError("Vendor backend timeout", 504)
      : apiError("Vendor service unavailable", 503);
  }

  const payload = await parseJson(res);
  if (!res.ok) return apiError(readMessage(payload, "Failed to update vendor"), res.status);
  return apiSuccess("Vendor updated", null, 200);
}
