import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

async function isSessionValid(request: NextRequest): Promise<boolean> {
  const sessionToken = request.cookies.get("session")?.value;
  if (!sessionToken) {
    return false;
  }

  const backendBaseUrl = process.env.NEXT_BACKEND_API_URL;
  if (!backendBaseUrl) {
    return false;
  }

  try {
    const response = await fetch(`${backendBaseUrl}/api/v1/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
      cache: "no-store",
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith("/dashboard")) {
    const validSession = await isSessionValid(request);
    if (!validSession) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (path === "/login") {
    const validSession = await isSessionValid(request);
    if (validSession) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
