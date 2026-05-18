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
  { params }: { params: Promise<{ category: string }> }
) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Settings service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  const { category } = await params;
  if (!["business", "invoice", "whatsapp"].includes(category)) {
    return apiError("Invalid category", 400);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(`${backendURL}/api/v1/settings/${category}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
  } catch (error) {
    if (error instanceof BackendTimeoutError) {
      return apiError("Settings backend timeout", 504);
    }
    return apiError("Settings service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to fetch settings"),
      backendResponse.status
    );
  }

  // The backend might return the data directly or wrapped. 
  // Let's pass the raw payload back, as `unwrapBackendPayload` might drop keys if they match "data", 
  // but settings endpoints usually just return the JSON object directly.
  return apiSuccess("Settings fetched", unwrapBackendPayload(payload) ?? payload, 200);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Settings service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  const { category } = await params;
  if (!["business", "invoice", "whatsapp"].includes(category)) {
    return apiError("Invalid category", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON payload", 400);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(`${backendURL}/api/v1/settings/${category}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof BackendTimeoutError) {
      return apiError("Settings backend timeout", 504);
    }
    return apiError("Settings service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to update settings"),
      backendResponse.status,
      payload
    );
  }

  return apiSuccess("Settings updated", unwrapBackendPayload(payload), backendResponse.status || 200);
}
