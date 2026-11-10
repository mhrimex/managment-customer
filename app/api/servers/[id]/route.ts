import { NextRequest, NextResponse } from "next/server";
import { updateServer, deleteServer } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { validateServerBody } from "@/lib/server-validation";
import { refuseDelete } from "@/lib/api-errors";
import { checkServer } from "@/lib/checks";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const body = await request.json();
    const { data, error } = validateServerBody(body, true);
    if (error || !data) {
      return NextResponse.json({ success: false, error }, { status: 400 });
    }
    const check = await checkServer(data, id);
    if (check.error) return NextResponse.json({ success: false, error: check.error }, { status: 400 });
    if (check.ipInUse && !body.allow_same_ip) {
      return NextResponse.json(
        { success: false, code: "SAME_IP", error: `${check.ipInUse} already uses ${data.ip_address}.` },
        { status: 409 }
      );
    }

    const server = await updateServer(id, data);
    if (!server) {
      return NextResponse.json({ success: false, error: "Server not found" }, { status: 404 });
    }

    await logAuditEvent({
      user_id: user?.id,
      user_email: user?.email || "unknown",
      action: "UPDATE_SERVER",
      resource_type: "SERVER",
      resource_id: server.id,
      details: `Updated server "${server.server_name}" (${server.ip_address})`,
    }).catch(() => {});

    return NextResponse.json({ success: true, message: "Server updated", data: server });
  } catch (error) {
    console.error("PUT /api/servers/[id] error:", error);
    return NextResponse.json({ success: false, error: "Failed to update server" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const refused = await refuseDelete("server", id);
    if (refused) return refused;
    const result = await deleteServer(id);
    if (!result.deleted) {
      return NextResponse.json({ success: false, error: "Server not found" }, { status: 404 });
    }

    await logAuditEvent({
      user_id: user?.id,
      user_email: user?.email || "unknown",
      action: "DELETE_SERVER",
      resource_type: "SERVER",
      resource_id: id,
      details: `Deleted server ${id}`,
    }).catch(() => {});

    return NextResponse.json({ success: true, message: "Server deleted" });
  } catch (error) {
    console.error("DELETE /api/servers/[id] error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete server" }, { status: 500 });
  }
}
