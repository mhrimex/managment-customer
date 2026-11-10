import { NextRequest, NextResponse } from "next/server";
import { exportSystemBackup, restoreSystemBackup } from "@/lib/db";
import { getAuditLogs, resetAuditLogs, logAuditEvent } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;
    const user = await getCurrentUser();
    const backup = await exportSystemBackup();
    const auditLogs = await getAuditLogs({ limit: 500 });
    backup.audit_logs = auditLogs;
    backup.stats.audit_logs_count = auditLogs.length;

    // Log the backup export in audit trail
    await logAuditEvent({
      user_id: user?.id,
      user_email: user?.email || "system@omniops.internal",
      action: "EXPORT_BACKUP",
      resource_type: "SYSTEM",
      details: `Generated full system backup (${backup.stats.clients_count} clients, ${backup.stats.deployments_count} deployments, ${backup.stats.servers_count} servers).`,
    });

    const filename = `reflection-solutions-backup-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;

    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/backup error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate system backup." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;
    const user = await getCurrentUser();
    const body = await request.json();
    const backupData = body.data || body;

    if (!backupData || (!backupData.clients && !backupData.deployments)) {
      return NextResponse.json(
        { success: false, error: "Invalid backup file structure." },
        { status: 400 }
      );
    }

    const result = await restoreSystemBackup(backupData);

    if (backupData.audit_logs && Array.isArray(backupData.audit_logs)) {
      await resetAuditLogs(backupData.audit_logs);
    }

    // Log restore event
    await logAuditEvent({
      user_id: user?.id,
      user_email: user?.email || "system@omniops.internal",
      action: "RESTORE_BACKUP",
      resource_type: "SYSTEM",
      details: `Restored system from JSON backup (${backupData.clients?.length || 0} clients, ${backupData.deployments?.length || 0} deployments).`,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("POST /api/backup error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to restore backup." },
      { status: 500 }
    );
  }
}
