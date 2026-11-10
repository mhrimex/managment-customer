import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth";
import { SessionUser } from "@/types";

/**
 * Sign the user in (or refresh their session) with an HTTP-only cookie.
 * "Secure" only when the site is actually served over HTTPS (directly or behind a proxy),
 * otherwise browsers on other PCs using http://<server-ip> would drop the cookie.
 * Override with COOKIE_SECURE=true|false.
 */
export async function setSessionCookie(request: NextRequest, user: SessionUser) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const isHttps = forwardedProto ? forwardedProto === "https" : request.nextUrl.protocol === "https:";
  const secure = process.env.COOKIE_SECURE === "true" ? true : process.env.COOKIE_SECURE === "false" ? false : isHttps;

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, createSessionToken(user), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  });
}
