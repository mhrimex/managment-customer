import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyPassword, createSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { getUserByEmailOrName } from "@/lib/db";
import { SessionUser } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Accept either "identifier" (new) or legacy "email" field
    const identifier: string = (body.identifier || body.email || "").trim();
    const password: string = (body.password || "").trim();

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: "Username (or email) and password are required." },
        { status: 400 }
      );
    }

    const foundUser = await getUserByEmailOrName(identifier);

    if (!foundUser || !verifyPassword(password, foundUser.password_hash || "")) {
      return NextResponse.json(
        { success: false, error: "Invalid username/email or password." },
        { status: 401 }
      );
    }

    const sessionUser: SessionUser = {
      id: foundUser.id,
      name: foundUser.name,
      email: foundUser.email,
      role: foundUser.role,
    };

    const token = createSessionToken(sessionUser);

    // Set HTTP-only Cookie. "Secure" only when the site is actually served over
    // HTTPS (directly or behind a proxy) — otherwise browsers on other PCs using
    // http://<server-ip>:3000 would drop the cookie and login would silently fail.
    // Override with COOKIE_SECURE=true|false in .env.
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
    const isHttps = forwardedProto ? forwardedProto === "https" : request.nextUrl.protocol === "https:";
    const secure =
      process.env.COOKIE_SECURE === "true" ? true : process.env.COOKIE_SECURE === "false" ? false : isHttps;

    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    // Log to Audit Trail
    await logAuditEvent({
      user_id: sessionUser.id,
      user_email: sessionUser.email,
      action: "LOGIN",
      resource_type: "USER",
      resource_id: sessionUser.id,
      details: `User ${sessionUser.name} (${sessionUser.role}) logged in successfully.`,
      ip_address: request.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    return NextResponse.json({
      success: true,
      message: "Logged in successfully",
      user: sessionUser,
    });
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred during authentication." },
      { status: 500 }
    );
  }
}
