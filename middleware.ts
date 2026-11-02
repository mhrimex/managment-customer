import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionTokenEdge } from "@/lib/session-edge";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths that do not require authentication
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico" ||
    /\.(svg|png|jpe?g|gif|webp|ico|woff2?)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  // Verify the HMAC signature and expiry — not just that a cookie exists
  const session = await verifySessionTokenEdge(token);

  // Login page: signed-in users go straight to the dashboard
  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    const res = NextResponse.next();
    if (token) res.cookies.delete(AUTH_COOKIE_NAME); // clear invalid/expired cookie
    return res;
  }

  if (!session) {
    // API callers get a JSON 401 instead of an HTML redirect
    if (pathname.startsWith("/api/")) {
      const res = NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
      if (token) res.cookies.delete(AUTH_COOKIE_NAME);
      return res;
    }

    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    const res = NextResponse.redirect(loginUrl);
    if (token) res.cookies.delete(AUTH_COOKIE_NAME);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
