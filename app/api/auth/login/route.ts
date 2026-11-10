import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, DEFAULT_PASSWORDS } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session-cookie";
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
      // still on a default password: middleware.ts sends them to /change-password first
      must_change_password: DEFAULT_PASSWORDS.includes(password),
    };

    await setSessionCookie(request, sessionUser);

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
