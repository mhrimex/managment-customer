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
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
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
    let mustChange = false;
    if (token) {
      try {
        const r = await fetch(apiUrl() + "/api/auth/me", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
          cache: "no-store",
        });
        signedIn = r.ok;
        if (r.ok) mustChange = (await r.json().catch(() => null))?.user?.must_change_password === true;
      } catch {
        // API unreachable: let the page load; its data calls will show the error
        signedIn = true;
      }
    }
    return pageGate(request, pathname, signedIn, token, mustChange);
  }

  // ---------------- API-only build ----------------
  if (TARGET === "api" && !pathname.startsWith("/api/")) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  // ---------------- api + all: verify the signed session ----------------
  if (isPublicAsset(pathname) || pathname.startsWith("/api/auth/login")) {
    return NextResponse.next();
  }
  // The site's look is needed on the login page too; saving it still requires an admin.
  if (pathname === "/api/appearance" && request.method === "GET") {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  // Verify the HMAC signature and expiry — not just that a cookie exists
  const session = await verifySessionTokenEdge(token);

  if (pathname.startsWith("/api/")) {
    // Still on a default password: only signing in/out, changing it and the page look work
    if (session?.must_change_password && !/^\/api\/(auth\/|appearance$|version$)/.test(pathname)) {
      return NextResponse.json(
        { success: false, error: "Change your password first.", must_change_password: true },
        { status: 403 }
      );
    }
    if (session) return NextResponse.next();
    // API callers get a JSON 401 instead of an HTML redirect
    const res = NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    if (token) res.cookies.delete(AUTH_COOKIE_NAME);
    return res;
  }

  return pageGate(request, pathname, !!session, token, !!session?.must_change_password);
}

/**
 * Redirect on the address the visitor actually opened. Behind IIS (or any reverse proxy)
 * request.url is the internal address (e.g. http://localhost:46461), so build the target
 * from the forwarded Host / X-Forwarded-Proto headers instead.
 */
function redirectTo(request: NextRequest, location: string) {
  const first = (v: string | null) => (v || "").split(",")[0].trim();
  const proto = first(request.headers.get("x-forwarded-proto")) || request.nextUrl.protocol.replace(":", "");
  const host = first(request.headers.get("x-forwarded-host")) || first(request.headers.get("host")) || request.nextUrl.host;
  let target: URL;
  try {
    target = new URL(location, `${proto === "https" ? "https" : "http"}://${host}`);
  } catch {
    target = new URL(location, request.url); // malformed Host header: fall back
  }
  return NextResponse.redirect(target, 307);
}

/** Login page / protected page redirects, shared by the "all" and "web" modes. */
function pageGate(request: NextRequest, pathname: string, signedIn: boolean, token?: string, mustChange = false) {
  // Login page: signed-in users go straight to the dashboard
  if (pathname === "/login") {
    if (signedIn) return redirectTo(request, "/");
    const res = NextResponse.next();
    if (token) res.cookies.delete(AUTH_COOKIE_NAME); // clear invalid/expired cookie
    return res;
  }

  if (!signedIn) {
    const location = pathname !== "/" ? `/login?redirect=${encodeURIComponent(pathname)}` : "/login";
    const res = redirectTo(request, location);
    if (token) res.cookies.delete(AUTH_COOKIE_NAME);
    return res;
  }

  // Signed in with a default password: nothing else until it is changed
  if (mustChange && pathname !== "/change-password") return redirectTo(request, "/change-password");

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
