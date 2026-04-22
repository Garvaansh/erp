import { cookies } from "next/headers";
import {
  apiError,
  apiSuccess,
  BackendTimeoutError,
  fetchWithTimeout,
  getBackendBaseUrl,
  parseJson,
  readMessage,
  unwrapBackendPayload,
  isRecord,
} from "@/app/api/_shared/http";

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

type BackendLoginResponse = {
  expires_in?: unknown;
  expires_at?: unknown;
  user?: unknown;
  message?: unknown;
  data?: unknown;
};

function resolveSessionMaxAge(payload: BackendLoginResponse): number | null {
  if (
    typeof payload.expires_in === "number" &&
    Number.isFinite(payload.expires_in)
  ) {
    const seconds = Math.floor(payload.expires_in);
    return seconds > 0 ? seconds : null;
  }

  if (
    typeof payload.expires_at === "number" &&
    Number.isFinite(payload.expires_at)
  ) {
    const seconds = Math.floor(payload.expires_at - Date.now() / 1000);
    return seconds > 0 ? seconds : null;
  }

  return null;
}

export async function POST(request: Request) {
  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return apiError("Invalid request body", 400);
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return apiError("Email and password are required", 400);
  }

  const backendBaseUrl = getBackendBaseUrl();
  if (!backendBaseUrl) {
    return apiError("Authentication service unavailable", 500);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(
      `${backendBaseUrl}/api/v1/auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      },
    );
  } catch (error) {
    if (error instanceof BackendTimeoutError) {
      return apiError("Authentication backend timeout", 504);
    }

    return apiError("Authentication service unavailable", 503);
  }

  const responsePayload = (await parseJson(
    backendResponse,
  )) as BackendLoginResponse | null;

  if (!backendResponse.ok) {
    const backendMessage = readMessage(responsePayload, "Invalid credentials");

    const status = backendResponse.status === 401 ? 401 : 400;
    return apiError(backendMessage, status);
  }

  const jwtToken = backendResponse.headers.get("x-session-token") ?? "";

  const sessionMaxAge = responsePayload
    ? resolveSessionMaxAge(responsePayload)
    : null;

  if (!jwtToken || !sessionMaxAge) {
    return apiError("Authentication failed", 502);
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: "session",
    value: jwtToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: sessionMaxAge,
  });

  const rawData = unwrapBackendPayload(responsePayload);
  const data = isRecord(rawData) && "user" in rawData ? { user: rawData.user } : { user: responsePayload?.user ?? null };

  return apiSuccess(
    readMessage(responsePayload, "Login successful"),
    data,
    200,
  );
}
