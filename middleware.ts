import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionTokenEdge } from "@/lib/session-edge";

/*
 * One codebase, three ways to run (APP_TARGET is fixed at build time, see next.config.mjs):
 *   all  - development / `npm start`: website + API in one server (default)
 *   web  - deployment "application" folder: website only. /api/* requests are
 *          forwarded to the separate API server (API_URL in settings.env), so the
 *          browser only ever talks to the website and login cookies just work.
 *   api  - deployment "api" folder: API only. Anything else is 404.
 */
const TARGET = process.env.APP_TARGET || "all";

function isPublicAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico" ||
    /\.(svg|png|jpe?g|gif|webp|ico|woff2?)$/i.test(pathname)
  );
}

function apiUrl(): string {
  return (process.env.API_URL || "http://127.0.0.1:4000").replace(/\/+$/, "");
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // ---------------- website-only build ----------------
  if (TARGET === "web") {
    // Forward every API call to the API server (acts as a reverse proxy)
    if (pathname.startsWith("/api/")) {
      return NextResponse.rewrite(new URL(pathname + search, apiUrl()));
    }
    if (isPublicAsset(pathname)) return NextResponse.next();

    // Page access: the API decides whether the session cookie is valid
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    let signedIn = false;
    if (token) {
      try {
        const r = await fetch(apiUrl() + "/api/auth/me", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
          cache: "no-store",
        });
        signedIn = r.ok;
      } catch {
        // API unreachable: let the page load; its data calls will show the error
        signedIn = true;
      }
    }
    return pageGate(request, pathname, signedIn, token);
  }

  // ---------------- API-only build ----------------
  if (TARGET === "api" && !pathname.startsWith("/api/")) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  // ---------------- api + all: verify the signed session ----------------
  if (isPublicAsset(pathname) || pathname.startsWith("/api/auth/login")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  // Verify the HMAC signature and expiry — not just that a cookie exists
  const session = await verifySessionTokenEdge(token);

  if (pathname.startsWith("/api/")) {
    if (session) return NextResponse.next();
    // API callers get a JSON 401 instead of an HTML redirect
    const res = NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    if (token) res.cookies.delete(AUTH_COOKIE_NAME);
    return res;
  }

  return pageGate(request, pathname, !!session, token);
}

/** Login page / protected page redirects, shared by the "all" and "web" modes. */
function pageGate(request: NextRequest, pathname: string, signedIn: boolean, token?: string) {
  // Login page: signed-in users go straight to the dashboard
  if (pathname === "/login") {
    if (signedIn) return NextResponse.redirect(new URL("/", request.url));
    const res = NextResponse.next();
    if (token) res.cookies.delete(AUTH_COOKIE_NAME); // clear invalid/expired cookie
    return res;
  }

  if (!signedIn) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("redirect", pathname);
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
