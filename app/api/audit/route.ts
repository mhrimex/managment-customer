import { NextRequest, NextResponse } from "next/server";
import { getAuditLogs, logAuditEvent } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    // Only authenticated users can view audit logs
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || undefined;
    const search = searchParams.get("search") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 100;

    const logs = await getAuditLogs({ action, search, limit });

    return NextResponse.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error("GET /api/audit error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await request.json();
    const { action, resource_type, resource_id, details } = body;

    const log = await logAuditEvent({
      user_id: user?.id || null,
      user_email: user?.email || "anonymous@omniops.internal",
      action: action || "CUSTOM_ACTION",
      resource_type: resource_type || "SYSTEM",
      resource_id: resource_id || null,
      details: details || null,
      ip_address: request.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    return NextResponse.json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error("POST /api/audit error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record audit event" },
      { status: 500 }
    );
  }
}
