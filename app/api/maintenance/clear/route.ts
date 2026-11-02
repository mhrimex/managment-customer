import { NextRequest, NextResponse } from "next/server";
import { clearOrResetSystemData } from "@/lib/db";
import { resetAuditLogs, logAuditEvent } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await request.json();
    const { mode, confirmation } = body;

    if (confirmation !== "CONFIRM") {
      return NextResponse.json(
        { success: false, error: "Confirmation keyword 'CONFIRM' is required to proceed." },
        { status: 400 }
      );
    }

    if (mode !== "reset_seed" && mode !== "clear_all") {
      return NextResponse.json(
        { success: false, error: "Mode must be 'reset_seed' or 'clear_all'." },
        { status: 400 }
      );
    }

    const result = await clearOrResetSystemData(mode);

    if (mode === "reset_seed") {
      await resetAuditLogs();
    } else {
      await resetAuditLogs([]);
    }

    // Record the maintenance event in audit trail
    await logAuditEvent({
      user_id: user?.id,
      user_email: user?.email || "system@omniops.internal",
      action: mode === "reset_seed" ? "RESET_SEED_DATA" : "PURGE_ALL_DATA",
      resource_type: "SYSTEM",
      details: mode === "reset_seed"
        ? "System was restored to sample seed records."
        : "System database was completely purged of all clients, servers, deployments, solutions, and credentials.",
    });

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("POST /api/maintenance/clear error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to perform maintenance operation." },
      { status: 500 }
    );
  }
}
