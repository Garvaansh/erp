import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type BackendMeResponse = {
  user?: unknown;
  message?: unknown;
};

export async function GET() {
  const backendBaseUrl = process.env.NEXT_BACKEND_API_URL;
  if (!backendBaseUrl) {
    return NextResponse.json(
      { message: "Authentication service unavailable" },
      { status: 500 },
    );
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;
  if (!sessionToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${backendBaseUrl}/api/v1/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { message: "Authentication service unavailable" },
      { status: 503 },
    );
  }

  let payload: BackendMeResponse | null = null;
  try {
    payload = (await backendResponse.json()) as BackendMeResponse;
  } catch {
    payload = null;
  }

  if (!backendResponse.ok) {
    const backendMessage =
      payload && typeof payload.message === "string"
        ? payload.message
        : "Unauthorized";
    return NextResponse.json({ message: backendMessage }, { status: 401 });
  }

  return NextResponse.json({ user: payload?.user ?? null }, { status: 200 });
}
