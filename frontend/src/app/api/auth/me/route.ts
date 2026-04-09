import { cookies } from "next/headers";
import {
  apiError,
  apiSuccess,
  BackendTimeoutError,
  fetchWithTimeout,
  getBackendBaseUrl,
  isRecord,
  parseJson,
  readMessage,
  unwrapBackendPayload,
} from "@/app/api/_shared/http";

type BackendMeResponse = {
  user?: unknown;
  message?: unknown;
  data?: unknown;
};

function sanitizeAuthData(payload: unknown): { user: unknown } {
  const raw = unwrapBackendPayload(payload);
  if (isRecord(raw) && "user" in raw) {
    return { user: raw.user };
  }

  if (isRecord(payload) && "user" in payload) {
    return { user: payload.user };
  }

  return { user: null };
}

export async function GET() {
  const backendBaseUrl = getBackendBaseUrl();
  if (!backendBaseUrl) {
    return apiError("Authentication service unavailable", 500);
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;
  if (!sessionToken) {
    return apiError("Unauthorized", 401);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(
      `${backendBaseUrl}/api/v1/auth/me`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      },
    );
  } catch (error) {
    if (error instanceof BackendTimeoutError) {
      return apiError("Authentication backend timeout", 504);
    }

    return apiError("Authentication service unavailable", 503);
  }

  const payload = (await parseJson(
    backendResponse,
  )) as BackendMeResponse | null;

  if (!backendResponse.ok) {
    return apiError(readMessage(payload, "Unauthorized"), 401);
  }

  return apiSuccess(
    readMessage(payload, "Authenticated user retrieved"),
    sanitizeAuthData(payload),
    200,
  );
}
