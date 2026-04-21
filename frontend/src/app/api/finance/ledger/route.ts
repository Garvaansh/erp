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
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Finance service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  const { searchParams } = request.nextUrl;
  const query = new URLSearchParams();

  const fromDate = searchParams.get("from_date");
  const toDate = searchParams.get("to_date");

  if (fromDate) {
    query.set("from_date", fromDate);
  }

  if (toDate) {
    query.set("to_date", toDate);
  }

  const suffix = query.toString();
  const url = suffix
    ? `${backendURL}/api/v1/finance/ledger?${suffix}`
    : `${backendURL}/api/v1/finance/ledger`;

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    if (error instanceof BackendTimeoutError) {
      return apiError("Finance backend timeout", 504);
    }

    return apiError("Finance service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);

  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to fetch ledger"),
      backendResponse.status,
      unwrapBackendPayload(payload),
    );
  }

  const data = unwrapBackendPayload(payload);

  return apiSuccess(
    readMessage(payload, "Ledger fetched"),
    Array.isArray(data) ? data : [],
    200,
  );
}
