import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, newPasswordProblem, verifyPassword } from "@/lib/auth";
import { getUserById, updateUser } from "@/lib/db";
import { setSessionCookie } from "@/lib/session-cookie";
import { logAuditEvent } from "@/lib/audit";

/** POST { current_password, new_password }  - the signed-in user changes their own password */
export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });

    const body = await request.json();
    const current = typeof body?.current_password === "string" ? body.current_password : "";
    const next = typeof body?.new_password === "string" ? body.new_password.trim() : "";

    const user = await getUserById(session.id);
    if (!user) return NextResponse.json({ success: false, error: "Your user no longer exists" }, { status: 401 });
    if (!verifyPassword(current.trim(), user.password_hash || "")) {
      return NextResponse.json({ success: false, error: "The current password is wrong." }, { status: 400 });
    }
    const problem = newPasswordProblem(next, current.trim());
    if (problem) return NextResponse.json({ success: false, error: problem }, { status: 400 });

    const updated = await updateUser(user.id, { password: next });
    if (!updated) return NextResponse.json({ success: false, error: "Failed to change the password" }, { status: 500 });

    // New session without the "must change" flag
    await setSessionCookie(request, { id: user.id, name: user.name, email: user.email, role: user.role });

    await logAuditEvent({
      user_id: user.id,
      user_email: user.email,
      action: "CHANGE_PASSWORD",
      resource_type: "USER",
      resource_id: user.id,
      details: session.must_change_password
        ? `${user.name} replaced the default password`
        : `${user.name} changed their password`,
      ip_address: request.headers.get("x-forwarded-for") || "127.0.0.1",
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/auth/change-password error:", error);
    return NextResponse.json({ success: false, error: "Failed to change the password" }, { status: 500 });
  }
}
