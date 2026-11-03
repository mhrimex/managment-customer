import { NextRequest, NextResponse } from "next/server";
import { revealAccountPassword } from "@/lib/employees";
import { getCurrentUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { apiError } from "@/lib/api-errors";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/server-accounts/<id>/password?purpose=reveal|copy  - one password, recorded in the audit trail */
export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });

    const result = await revealAccountPassword(id);
    if (!result) return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
    if (result.password === null) {
      return NextResponse.json({ success: false, error: "No password saved for this account" }, { status: 404 });
    }

    const purpose = new URL(request.url).searchParams.get("purpose") === "copy" ? "Copied" : "Revealed";
    await logAuditEvent({
      user_id: user.id,
      user_email: user.email,
      action: "VIEW_CREDENTIAL",
      resource_type: "ACCOUNT",
      resource_id: id,
      details: `${purpose} password of account "${result.account.username}" on ${result.account.server_name}`,
      ip_address: request.headers.get("x-forwarded-for") || "127.0.0.1",
    }).catch(() => {});

    return NextResponse.json(
      { success: true, data: { password: result.password } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return apiError(err, "GET /api/server-accounts/[id]/password", "Failed to read password");
  }
}
