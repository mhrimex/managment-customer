import { NextRequest, NextResponse } from "next/server";
import { updateAccount, deleteAccount } from "@/lib/employees";
import { getCurrentUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { apiError } from "@/lib/api-errors";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const body = await request.json();
    const account = await updateAccount(id, body);
    if (!account) return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
    const pw = body?.clear_password ? "; password removed" : body?.password ? "; password changed" : "";
    const access = account.companies.map((c) => c.company_name).join(", ") || "none";
    await logAuditEvent({
      user_id: user?.id,
      user_email: user?.email || "unknown",
      action: "UPDATE_ACCOUNT",
      resource_type: "ACCOUNT",
      resource_id: id,
      details: `Updated account "${account.username}" on ${account.server_name} (access: ${access})${pw}`,
    }).catch(() => {});
    return NextResponse.json({ success: true, data: account });
  } catch (err) {
    return apiError(err, "PUT /api/server-accounts/[id]", "Failed to update server account");
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const account = await deleteAccount(id);
    if (!account) return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
    await logAuditEvent({
      user_id: user?.id,
      user_email: user?.email || "unknown",
      action: "DELETE_ACCOUNT",
      resource_type: "ACCOUNT",
      resource_id: id,
      details: `Deleted account "${account.username}" on ${account.server_name} (${account.employee_name})`,
    }).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(err, "DELETE /api/server-accounts/[id]", "Failed to delete server account");
  }
}
