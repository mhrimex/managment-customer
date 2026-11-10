import { NextRequest, NextResponse } from "next/server";
import { getEmployee, updateEmployee, deleteEmployee } from "@/lib/employees";
import { getCurrentUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { apiError, refuseDelete } from "@/lib/api-errors";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const employee = await getEmployee((await params).id);
    if (!employee) return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: employee });
  } catch (err) {
    return apiError(err, "GET /api/employees/[id]", "Failed to load employee");
  }
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const employee = await updateEmployee(id, await request.json());
    if (!employee) return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
    await logAuditEvent({
      user_id: user?.id,
      user_email: user?.email || "unknown",
      action: "UPDATE_EMPLOYEE",
      resource_type: "EMPLOYEE",
      resource_id: id,
      details: `Updated employee "${employee.full_name}"`,
    }).catch(() => {});
    return NextResponse.json({ success: true, data: employee });
  } catch (err) {
    return apiError(err, "PUT /api/employees/[id]", "Failed to update employee");
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const refused = await refuseDelete("employee", id);
    if (refused) return refused;
    const result = await deleteEmployee(id);
    if (!result.deleted) return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
    await logAuditEvent({
      user_id: user?.id,
      user_email: user?.email || "unknown",
      action: "DELETE_EMPLOYEE",
      resource_type: "EMPLOYEE",
      resource_id: id,
      details: `Deleted employee "${result.name}"`,
    }).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(err, "DELETE /api/employees/[id]", "Failed to delete employee");
  }
}
