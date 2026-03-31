import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Check for the authentication cookie
  const hasAuthCookie = request.cookies.has("jwt_token");

  // If the user is trying to access the dashboard without a cookie, redirect to login
  if (path.startsWith("/dashboard") && !hasAuthCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If the user is on the login page but already has a cookie, redirect to the dashboard
  if (path === "/login" && hasAuthCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
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
