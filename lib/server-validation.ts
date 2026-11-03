import { SERVER_TYPES } from "@/lib/db";
import { Server } from "@/types";

/** Validate a create/update body for a server. `partial` = update (fields optional). */
export function validateServerBody(body: any, partial: boolean): { data?: Partial<Server>; error?: string } {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : v === undefined || v === null ? undefined : String(v).trim());
  const data: Partial<Server> = {};

  const name = str(body?.server_name);
  const provider = str(body?.provider);
  const ip = str(body?.ip_address);

  if (!partial || name !== undefined) {
    if (!name) return { error: "Server name is required" };
    if (name.length > 255) return { error: "Server name is too long (max 255)" };
    data.server_name = name;
  }
  if (!partial || provider !== undefined) {
    if (!provider) return { error: "Provider is required" };
    if (provider.length > 100) return { error: "Provider is too long (max 100)" };
    data.provider = provider;
  }
  if (!partial || ip !== undefined) {
    if (!ip) return { error: "IP address / host is required" };
    if (ip.length > 45) return { error: "IP address is too long (max 45 characters)" };
    data.ip_address = ip;
  }
  if (body?.server_type !== undefined || !partial) {
    const t = body?.server_type ?? "CLOUD_VPS";
    if (!(SERVER_TYPES as readonly string[]).includes(t)) return { error: "Invalid server type" };
    data.server_type = t;
  }
  if (body?.login_notes !== undefined) {
    data.login_notes = str(body.login_notes) || null;
  }
  return { data };
}
