import { AuditLog } from "@/types";
import { query } from "./db";

const initialAuditLogs: AuditLog[] = [
  {
    id: "77777777-7777-7777-7777-777777777701",
    user_email: "admin@agency.com",
    action: "LOGIN",
    resource_type: "USER",
    resource_id: "66666666-6666-6666-6666-666666666601",
    details: "Staff administrator logged into management console",
    ip_address: "127.0.0.1",
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: "77777777-7777-7777-7777-777777777702",
    user_email: "support@agency.com",
    action: "VIEW_CREDENTIAL",
    resource_type: "CREDENTIAL",
    resource_id: "55555555-5555-5555-5555-555555555503",
    details: "Viewed and copied DB Password for Acme Logistics Global",
    ip_address: "192.168.1.45",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

const globalAuditStore = global as unknown as {
  _db_audit_logs?: AuditLog[];
};

if (!globalAuditStore._db_audit_logs) {
  globalAuditStore._db_audit_logs = [...initialAuditLogs];
}

export async function logAuditEvent(entry: {
  user_id?: string | null;
  user_email: string;
  action: string;
  resource_type: 'CREDENTIAL' | 'CLIENT' | 'DEPLOYMENT' | 'SERVER' | 'SOLUTION' | 'USER' | 'SYSTEM';
  resource_id?: string | null;
  details?: string | null;
  ip_address?: string | null;
}): Promise<AuditLog> {
  const newLog: AuditLog = {
    id: crypto.randomUUID(),
    user_id: entry.user_id || null,
    user_email: entry.user_email,
    action: entry.action,
    resource_type: entry.resource_type,
    resource_id: entry.resource_id || null,
    details: entry.details || null,
    ip_address: entry.ip_address || "127.0.0.1",
    created_at: new Date().toISOString(),
  };

  try {
    await query(
      `INSERT INTO audit_logs (id, user_id, user_email, action, resource_type, resource_id, details, ip_address)
       VALUES (@id, @user_id, @user_email, @action, @resource_type, @resource_id, @details, @ip_address)`,
      {
        id: newLog.id,
        user_id: newLog.user_id,
        user_email: newLog.user_email,
        action: newLog.action,
        resource_type: newLog.resource_type,
        resource_id: newLog.resource_id,
        details: newLog.details,
        ip_address: newLog.ip_address,
      }
    );
    const rows = await query<AuditLog>("SELECT * FROM audit_logs WHERE id = @id", { id: newLog.id });
    if (rows && rows.length > 0) return rows[0];
  } catch {
    // Fallback to in-memory store
  }

  globalAuditStore._db_audit_logs = [newLog, ...(globalAuditStore._db_audit_logs || [])];
  return newLog;
}

export async function getAuditLogs(params?: {
  action?: string;
  search?: string;
  limit?: number;
}): Promise<AuditLog[]> {
  try {
    let sqlText = "SELECT TOP (@limit) * FROM audit_logs";
    const p: Record<string, any> = { limit: params?.limit || 100 };
    const conditions: string[] = [];

    if (params?.action && params.action !== "all") {
      p.action = params.action;
      conditions.push("action = @action");
    }
    if (params?.search) {
      p.search = `%${params.search}%`;
      conditions.push("(user_email LIKE @search OR details LIKE @search OR action LIKE @search)");
    }

    if (conditions.length > 0) {
      sqlText += " WHERE " + conditions.join(" AND ");
    }

    sqlText += " ORDER BY created_at DESC";
    const rows = await query<AuditLog>(sqlText, p);
    return rows;
  } catch {
    // In-memory fallback
  }

  let logs = globalAuditStore._db_audit_logs || [];
  if (params?.action && params.action !== "all") {
    logs = logs.filter((l) => l.action === params.action);
  }
  if (params?.search) {
    const q = params.search.toLowerCase().trim();
    logs = logs.filter(
      (l) =>
        l.user_email.toLowerCase().includes(q) ||
        (l.details && l.details.toLowerCase().includes(q)) ||
        l.action.toLowerCase().includes(q)
    );
  }
  return logs.slice(0, params?.limit || 100);
}

export async function resetAuditLogs(newLogs?: AuditLog[]) {
  try {
    await query("DELETE FROM audit_logs");
    if (newLogs && newLogs.length > 0) {
      for (const log of newLogs) {
        await query(
          `INSERT INTO audit_logs (id, user_id, user_email, action, resource_type, resource_id, details, ip_address, created_at)
           VALUES (@id, @user_id, @user_email, @action, @resource_type, @resource_id, @details, @ip_address, @created_at)`,
          {
            id: log.id, user_id: log.user_id, user_email: log.user_email, action: log.action,
            resource_type: log.resource_type, resource_id: log.resource_id, details: log.details,
            ip_address: log.ip_address, created_at: log.created_at,
          }
        );
      }
    }
  } catch {
    // In-memory fallback
  }

  globalAuditStore._db_audit_logs = newLogs ? [...newLogs] : [...initialAuditLogs];
}
