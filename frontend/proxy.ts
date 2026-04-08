import { NextRequest, NextResponse } from "next/server";

// Routes that must NOT require auth.
// Uses startsWith matching — keep these precise.
const PUBLIC_PATH_PREFIXES = ["/login", "/api/"];

// The cookie name must match what the login BFF sets.
const SESSION_COOKIE = "session";

const AUTH_TIMEOUT_MS = 5000;

function resolveBackendBaseUrl(): string | null {
  const backend = process.env.NEXT_BACKEND_API_URL?.trim();
  if (backend) {
    return backend.replace(/\/$/, "");
  }

  const publicApi = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!publicApi) {
    return null;
  }

  const normalized = publicApi.replace(/\/$/, "");
  return normalized.endsWith("/v1") ? normalized.slice(0, -3) : normalized;
}

async function isSessionValid(sessionToken: string): Promise<boolean> {
  const backendBaseUrl = resolveBackendBaseUrl();
  if (!backendBaseUrl) {
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${backendBaseUrl}/api/v1/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";

  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set("next", nextPath || "/dashboard");

  return NextResponse.redirect(loginUrl);
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Always pass through Next.js internals and static assets.
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value?.trim() || "";
  const hasSessionCookie = Boolean(sessionToken);

  // --- Case 1: Public path (e.g. /login, /api/*) ---
  if (isPublicPath(pathname)) {
    // If the user is already authenticated and tries to visit /login,
    // send them to the dashboard so the login page never renders.
    if (hasSessionCookie && pathname.startsWith("/login")) {
      const valid = await isSessionValid(sessionToken);
      if (!valid) {
        return clearSessionCookie(NextResponse.next());
      }

      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      return NextResponse.redirect(dashboardUrl);
    }

    // For all other public paths (including all /api/* routes), pass through.
    return NextResponse.next();
  }

  // --- Case 2: Protected path (everything else, e.g. /dashboard, /) ---
  if (!hasSessionCookie) {
    return redirectToLogin(request);
  }

  const valid = await isSessionValid(sessionToken);
  if (!valid) {
    return clearSessionCookie(redirectToLogin(request));
  }

  // Authenticated user accessing a protected route — allow through.
  return NextResponse.next();
}

export const config = {
  /*
   * Match every route EXCEPT Next.js static file routes.
   * The proxy function itself handles the _next/ and asset filtering
   * as well as the public/protected branching logic.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
