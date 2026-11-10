import { NextRequest, NextResponse } from "next/server";
import { offboardEmployee } from "@/lib/employees";
import { getCurrentUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { apiError } from "@/lib/api-errors";

/** POST /api/employees/<id>/offboard  - employee leaving: inactive + all their accounts disabled */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const result = await offboardEmployee(id);
    if (!result) return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
    const logins = (result.employee.accounts || []).map((a) => `${a.username} on ${a.server_name}`).join(", ") || "none";
    await logAuditEvent({
      user_id: user?.id,
      user_email: user?.email || "unknown",
      action: "OFFBOARD_EMPLOYEE",
      resource_type: "EMPLOYEE",
      resource_id: id,
      details: `${result.employee.full_name} left: marked inactive, ${result.disabled} account(s) disabled (${logins})`,
    }).catch(() => {});
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return apiError(err, "POST /api/employees/[id]/offboard", "Failed to process the employee leaving");
  }
}
