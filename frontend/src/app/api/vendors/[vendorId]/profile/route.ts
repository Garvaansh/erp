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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ vendorId: string }> },
) {
  const { vendorId } = await params;
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Vendor service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(
      `${backendURL}/api/v1/vendors/${encodeURIComponent(vendorId)}/profile`,
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
      return apiError("Vendor backend timeout", 504);
    }
    return apiError("Vendor service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to fetch vendor profile"),
      backendResponse.status,
      unwrapBackendPayload(payload),
    );
  }

  return apiSuccess(
    readMessage(payload, "Vendor profile fetched"),
    unwrapBackendPayload(payload),
  );
}
