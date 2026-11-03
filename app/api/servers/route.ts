import { NextRequest, NextResponse } from "next/server";
import { getServers, createServer } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { validateServerBody } from "@/lib/server-validation";

export async function GET() {
  try {
    const servers = await getServers();
    return NextResponse.json({
      success: true,
      count: servers.length,
      data: servers,
    });
  } catch (error) {
    console.error("GET /api/servers error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve servers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { data, error } = validateServerBody(await request.json(), false);
    if (error || !data) {
      return NextResponse.json({ success: false, error }, { status: 400 });
    }

    const server = await createServer(data);

    await logAuditEvent({
      user_id: user?.id,
      user_email: user?.email || "unknown",
      action: "CREATE_SERVER",
      resource_type: "SERVER",
      resource_id: server.id,
      details: `Added server "${server.server_name}" (${server.ip_address})`,
    }).catch(() => {});

    return NextResponse.json(
      { success: true, message: "Server created successfully", data: server },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/servers error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create server" },
      { status: 500 }
    );
  }
}
