import { NextRequest, NextResponse } from "next/server";
import { listAccounts, createAccount } from "@/lib/employees";
import { getCurrentUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { apiError } from "@/lib/api-errors";

/** GET /api/server-accounts?server_id=&client_id=&employee_id=&q=   (passwords are never included) */
export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams;
    const data = await listAccounts({
      server_id: sp.get("server_id") || undefined,
      client_id: sp.get("client_id") || undefined,
      employee_id: sp.get("employee_id") || undefined,
      q: sp.get("q") || undefined,
    });
    return NextResponse.json({ success: true, count: data.length, data });
  } catch (err) {
    return apiError(err, "GET /api/server-accounts", "Failed to load server accounts");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const account = await createAccount(await request.json());
    const access = account.companies.map((c) => c.company_name).join(", ");
    await logAuditEvent({
      user_id: user?.id,
      user_email: user?.email || "unknown",
      action: "CREATE_ACCOUNT",
      resource_type: "ACCOUNT",
      resource_id: account.id,
      details: `Added account "${account.username}" on ${account.server_name} for ${account.employee_name}` +
        (access ? ` (access: ${access})` : ""),
    }).catch(() => {});
    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (err) {
    return apiError(err, "POST /api/server-accounts", "Failed to create server account");
  }
}
