import { NextRequest, NextResponse } from "next/server";

// Routes that must NOT require auth.
// Uses startsWith matching — keep these precise.
const PUBLIC_PATH_PREFIXES = ["/login", "/api/"];

// The cookie name must match what the login BFF sets.
const SESSION_COOKIE = "session";

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

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Always pass through Next.js internals and static assets.
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const hasSessionCookie = Boolean(
    request.cookies.get(SESSION_COOKIE)?.value?.trim(),
  );

  // --- Case 1: Public path (e.g. /login, /api/*) ---
  if (isPublicPath(pathname)) {
    // If the user is already authenticated and tries to visit /login,
    // send them to the dashboard so the login page never renders.
    if (hasSessionCookie && pathname.startsWith("/login")) {
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
