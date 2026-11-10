/**
 * Input checks shared by the create/edit routes: field formats and duplicates.
 * Each function returns a message that names the field (safe to show), or null when fine.
 */
import { getClients, getDeployments, getServers, getSolutions } from "@/lib/db";

const text = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const same = (a: unknown, b: unknown) => text(a).toLowerCase() === text(b).toLowerCase();
const sameId = (a?: string | null, b?: string | null) => (a || "").toLowerCase() === (b || "").toLowerCase();

// ---------------------------------------------------------------------------
// Formats (empty values are not checked here: "required" is checked separately)
// ---------------------------------------------------------------------------

const HOSTNAME = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;

function isIPv4(v: string) {
  const parts = v.split(".");
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

/** IPv4, IPv6 or a host name such as rimex.local */
export function isHost(v: string) {
  if (/^[\d.]+$/.test(v)) return isIPv4(v);
  if (v.includes(":")) return /^[0-9a-f:.]+$/i.test(v) && (v.match(/:/g) || []).length >= 2;
  return HOSTNAME.test(v);
}

export function emailError(label: string, value: unknown): string | null {
  const v = text(value);
  if (!v) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : `${label} is not a valid email address (example: name@company.com)`;
}

export function phoneError(label: string, value: unknown): string | null {
  const v = text(value);
  if (!v) return null;
  const digits = (v.match(/\d/g) || []).length;
  return /^\+?[0-9 ()\-./]{5,30}$/.test(v) && digits >= 5
    ? null
    : `${label} can only contain numbers, spaces, +, -, ( and ) (example: +961 1 234 567)`;
}

export function hostError(label: string, value: unknown): string | null {
  const v = text(value);
  if (!v) return null;
  return isHost(v) ? null : `${label} must be an IP address (example: 10.0.0.1) or a host name (example: rimex.local)`;
}

/** erp.client.com, https://erp.client.com/app or 10.0.0.1:8080 */
export function urlError(label: string, value: unknown): string | null {
  const v = text(value);
  if (!v) return null;
  const m = v.replace(/^https?:\/\//i, "").match(/^([^/:?#]+)(:\d{1,5})?([/?#].*)?$/);
  return m && (isHost(m[1]) || m[1].toLowerCase() === "localhost")
    ? null
    : `${label} must look like erp.company.com or https://erp.company.com`;
}

export function databaseNameError(value: unknown): string | null {
  const v = text(value);
  if (!v) return null;
  if (v.length > 100) return "Database name is too long (max 100 characters)";
  return /[;'"<>`\\]/.test(v) ? "Database name can't contain ; ' \" < > ` or \\" : null;
}

const first = (...errors: Array<string | null>) => errors.find(Boolean) || null;

// ---------------------------------------------------------------------------
// Whole records (format + duplicates). excludeId = the record being edited.
// ---------------------------------------------------------------------------

export async function checkClient(body: any, excludeId?: string): Promise<string | null> {
  const formatError = first(
    emailError("Email", body?.email),
    phoneError("Primary phone", body?.phone_primary),
    phoneError("Secondary phone", body?.phone_secondary)
  );
  if (formatError) return formatError;
  if (body?.company_name === undefined) return null;
  const twin = (await getClients()).find((c) => same(c.company_name, body.company_name) && !sameId(c.id, excludeId));
  return twin ? `A client named "${twin.company_name}" already exists` : null;
}

export async function checkSolution(name: unknown, excludeId?: string): Promise<string | null> {
  if (name === undefined) return null;
  const twin = (await getSolutions()).find((s) => same(s.name, name) && !sameId(s.id, excludeId));
  return twin ? `A solution named "${twin.name}" already exists` : null;
}

/** ipInUse: another server already has this IP. The caller may let the user confirm it. */
export async function checkServer(
  data: { server_name?: string; ip_address?: string },
  excludeId?: string
): Promise<{ error: string | null; ipInUse?: string }> {
  const formatError = hostError("IP address / host", data.ip_address);
  if (formatError) return { error: formatError };
  const others = (await getServers()).filter((s) => !sameId(s.id, excludeId));
  const named = data.server_name !== undefined && others.find((s) => same(s.server_name, data.server_name));
  if (named) return { error: `A server named "${named.server_name}" already exists` };
  const sameIp = data.ip_address !== undefined && others.find((s) => same(s.ip_address, data.ip_address));
  return sameIp ? { error: null, ipInUse: sameIp.server_name } : { error: null };
}

/** Same company + solution + server + database + environment = the same deployment twice. */
export async function checkDeployment(d: any, excludeId?: string): Promise<string | null> {
  const formatError = first(urlError("Domain / Instance URL", d?.instance_url), databaseNameError(d?.database_name));
  if (formatError) return formatError;
  const twin = (await getDeployments()).find(
    (x) =>
      !sameId(x.id, excludeId) &&
      sameId(x.client_id, d.client_id) &&
      sameId(x.solution_id, d.solution_id) &&
      sameId(x.server_id, d.server_id) &&
      same(x.database_name, d.database_name) &&
      same(x.environment, d.environment || "PRODUCTION")
  );
  if (!twin) return null;
  const where = [twin.server?.server_name ? `on ${twin.server.server_name}` : "with no server", twin.database_name ? `database ${twin.database_name}` : "no database name", twin.environment]
    .join(", ");
  return `${twin.client?.company_name || "This client"} already has ${twin.solution?.name || "this solution"} ${where}. Edit that deployment instead, or use a different database name.`;
}
