import { NextRequest, NextResponse } from "next/server";
import { listEmployees, createEmployee } from "@/lib/employees";
import { getCurrentUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { apiError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await listEmployees({
      search: searchParams.get("search") || undefined,
      client_id: searchParams.get("client_id") || undefined,
    });
    return NextResponse.json({ success: true, count: data.length, data });
  } catch (err) {
    return apiError(err, "GET /api/employees", "Failed to load employees");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const employee = await createEmployee(await request.json());
    await logAuditEvent({
      user_id: user?.id,
      user_email: user?.email || "unknown",
      action: "CREATE_EMPLOYEE",
      resource_type: "EMPLOYEE",
      resource_id: employee.id,
      details: `Added employee "${employee.full_name}"`,
    }).catch(() => {});
    return NextResponse.json({ success: true, data: employee }, { status: 201 });
  } catch (err) {
    return apiError(err, "POST /api/employees", "Failed to create employee");
  }
}
