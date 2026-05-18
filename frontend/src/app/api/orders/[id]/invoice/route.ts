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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  const { id } = await params;

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(`${backendURL}/api/v1/orders/${id}/invoice`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
  } catch (error) {
    if (error instanceof BackendTimeoutError) {
      return apiError("Backend timeout", 504);
    }
    return apiError("Service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to fetch invoice"),
      backendResponse.status
    );
  }

  return apiSuccess("Invoice fetched", unwrapBackendPayload(payload) ?? payload, 200);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  const { id } = await params;

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(`${backendURL}/api/v1/orders/${id}/invoice`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
  } catch (error) {
    if (error instanceof BackendTimeoutError) {
      return apiError("Backend timeout", 504);
    }
    return apiError("Service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to generate invoice"),
      backendResponse.status
    );
  }

  return apiSuccess("Invoice generated", unwrapBackendPayload(payload) ?? payload, 200);
}
