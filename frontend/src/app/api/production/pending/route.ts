import { NextRequest } from "next/server";
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
import { sanitizePendingApprovals } from "@/app/api/production/_shared";

export async function GET(request: NextRequest) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Production service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  const limit = request.nextUrl.searchParams.get("limit")?.trim() || "50";
  const offset = request.nextUrl.searchParams.get("offset")?.trim() || "0";

  let backendResponse: Response;
  try {
    const targetURL = new URL(`${backendURL}/api/v1/production/pending`);
    targetURL.searchParams.set("limit", limit);
    targetURL.searchParams.set("offset", offset);

    backendResponse = await fetchWithTimeout(targetURL.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    if (error instanceof BackendTimeoutError) {
      return apiError("Production backend timeout", 504);
    }

    return apiError("Production service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to fetch pending approvals"),
      backendResponse.status,
      unwrapBackendPayload(payload),
    );
  }

  return apiSuccess("Pending approvals loaded", {
    rows: sanitizePendingApprovals(payload),
  });
}
