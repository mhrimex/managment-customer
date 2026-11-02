import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, AUTH_COOKIE_NAME } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (user) {
      await logAuditEvent({
        user_id: user.id,
        user_email: user.email,
        action: "LOGOUT",
        resource_type: "USER",
        resource_id: user.id,
        details: `User ${user.email} logged out.`,
        ip_address: request.headers.get("x-forwarded-for") || "127.0.0.1",
      });
    }

    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE_NAME);

    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout API error:", error);
    return NextResponse.json(
      { success: false, error: "Logout failed" },
      { status: 500 }
    );
  }
}
