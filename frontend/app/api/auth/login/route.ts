import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

type BackendLoginResponse = {
  token?: unknown;
  expires_in?: unknown;
  expires_at?: unknown;
  user?: unknown;
  message?: unknown;
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
    return NextResponse.json(
      { message: "Invalid request body" },
      { status: 400 },
    );
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { message: "Email and password are required" },
      { status: 400 },
    );
  }

  const backendBaseUrl = process.env.NEXT_BACKEND_API_URL;
  if (!backendBaseUrl) {
    return NextResponse.json(
      { message: "Authentication service unavailable" },
      { status: 500 },
    );
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${backendBaseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { message: "Authentication service unavailable" },
      { status: 503 },
    );
  }

  let responsePayload: BackendLoginResponse | null = null;
  try {
    responsePayload = (await backendResponse.json()) as BackendLoginResponse;
  } catch {
    responsePayload = null;
  }

  if (!backendResponse.ok) {
    const backendMessage =
      responsePayload && typeof responsePayload.message === "string"
        ? responsePayload.message
        : "Invalid credentials";

    const status = backendResponse.status === 401 ? 401 : 400;
    return NextResponse.json({ message: backendMessage }, { status });
  }

  const jwtToken =
    responsePayload && typeof responsePayload.token === "string"
      ? responsePayload.token
      : "";

  const sessionMaxAge = responsePayload
    ? resolveSessionMaxAge(responsePayload)
    : null;

  if (!jwtToken || !sessionMaxAge) {
    return NextResponse.json(
      { message: "Authentication failed" },
      { status: 502 },
    );
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

  return NextResponse.json({ success: true }, { status: 200 });
}
