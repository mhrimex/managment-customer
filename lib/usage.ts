/**
 * "Where is this used?" Delete is refused until everything listed here is removed first.
 *
 *   company    <- deployments, employees
 *   solution   <- deployments
 *   server     <- deployments, employee accounts
 *   deployment <- still live (status not DECOMMISSIONED), employee access, vault keys
 *   employee   <- server accounts
 *   account    <- ticked access
 *
 * Vault keys are listed by label only, never by value.
 */
import { ItemUsage, UsageGroup, UsageItem, UsageKind } from "@/types/usage";
import { dbAvailable, getClientById, getDeploymentById, getDeployments, getServers, getSolutions, query } from "@/lib/db";
import { DbUnavailableError } from "@/lib/employees";

export const USAGE_KINDS: UsageKind[] = ["company", "solution", "server", "deployment", "employee", "account"];

/** Title of the group listing who can open a deployment (also used to guard edits). */
export const ACCESS_GROUP = "Employees with access";

function liveStatus(status: string, clientId: string): UsageGroup[] {
  if (status === "DECOMMISSIONED") return [];
  return group("Still in use", HINTS.deploymentLive, [{ label: `Status: ${status}`, href: `/clients/${clientId}` }]);
}

const joinParts = (...parts: Array<string | null | undefined>) => parts.filter(Boolean).join(" • ") || null;

const HINTS = {
  solutionDeployments: "Delete these deployments, or change them to another solution.",
  serverDeployments: "Delete these deployments, or move them to another server.",
  companyDeployments: "Delete these deployments first.",
  companyEmployees: "Delete these employees, or change their company.",
  serverAccounts: "Delete these accounts on each employee's page.",
  employeeAccounts: "Delete these accounts on the employee's page.",
  deploymentLive: "Edit the deployment and set Deployment Status to DECOMMISSIONED once it is no longer used.",
  deploymentAccess: "Edit each account on the employee's page and untick this deployment.",
  accountAccess: "Edit the account and untick these deployments.",
  deploymentVault: "Delete these keys on the company page.",
};

function group(title: string, hint: string, items: UsageItem[]): UsageGroup[] {
  return items.length ? [{ title, hint, items }] : [];
}

interface DeploymentRow {
  client_id: string; company_name: string; solution_name: string;
  server_name: string | null; database_name: string | null; environment: string;
}

async function sqlDeployments(column: "client_id" | "solution_id" | "server_id", id: string, showCompany: boolean): Promise<UsageItem[]> {
  const rows = await query<DeploymentRow>(
    `SELECT c.id AS client_id, c.company_name, s.name AS solution_name, sv.server_name, d.database_name, d.environment
       FROM client_deployments d
       JOIN clients c   ON c.id = d.client_id
       JOIN solutions s ON s.id = d.solution_id
       LEFT JOIN servers sv ON sv.id = d.server_id
      WHERE d.${column} = @id
      ORDER BY c.company_name, s.name, d.database_name`,
    { id }
  );
  return rows.map((r) => ({
    label: showCompany ? `${r.company_name} • ${r.solution_name}` : r.solution_name,
    detail: joinParts(r.database_name, r.environment, r.server_name),
    href: `/clients/${r.client_id}`,
  }));
}

async function sqlUsage(kind: UsageKind, id: string): Promise<ItemUsage | null> {
  switch (kind) {
    case "solution": {
      const row = (await query<{ name: string }>("SELECT name FROM solutions WHERE id = @id", { id }))[0];
      if (!row) return null;
      return { kind, name: row.name, groups: group("Deployments", HINTS.solutionDeployments, await sqlDeployments("solution_id", id, true)) };
    }
    case "company": {
      const row = (await query<{ company_name: string }>("SELECT company_name FROM clients WHERE id = @id", { id }))[0];
      if (!row) return null;
      const employees = await query<{ id: string; full_name: string; job_title: string | null }>(
        "SELECT id, full_name, job_title FROM employees WHERE client_id = @id ORDER BY full_name",
        { id }
      );
      return {
        kind,
        name: row.company_name,
        groups: [
          ...group("Deployments", HINTS.companyDeployments, await sqlDeployments("client_id", id, false)),
          ...group("Employees", HINTS.companyEmployees, employees.map((e) => ({ label: e.full_name, detail: e.job_title, href: `/employees/${e.id}` }))),
        ],
      };
    }
    case "server": {
      const row = (await query<{ server_name: string }>("SELECT server_name FROM servers WHERE id = @id", { id }))[0];
      if (!row) return null;
      const accounts = await query<{ employee_id: string; full_name: string; username: string }>(
        `SELECT a.employee_id, e.full_name, a.username FROM server_accounts a
           JOIN employees e ON e.id = a.employee_id
          WHERE a.server_id = @id ORDER BY a.username`,
        { id }
      );
      return {
        kind,
        name: row.server_name,
        groups: [
          ...group("Deployments", HINTS.serverDeployments, await sqlDeployments("server_id", id, true)),
          ...group("Employee accounts", HINTS.serverAccounts, accounts.map((a) => ({ label: a.username, detail: a.full_name, href: `/employees/${a.employee_id}` }))),
        ],
      };
    }
    case "deployment": {
      const row = (await query<{ client_id: string; company_name: string; solution_name: string; deployment_status: string }>(
        `SELECT c.id AS client_id, c.company_name, s.name AS solution_name, d.deployment_status
           FROM client_deployments d
           JOIN clients c   ON c.id = d.client_id
           JOIN solutions s ON s.id = d.solution_id
          WHERE d.id = @id`,
        { id }
      ))[0];
      if (!row) return null;
      const access = await query<{ employee_id: string; full_name: string; username: string; server_name: string }>(
        `SELECT a.employee_id, e.full_name, a.username, sv.server_name
           FROM server_account_deployments x
           JOIN server_accounts a ON a.id = x.account_id
           JOIN employees e  ON e.id = a.employee_id
           JOIN servers sv   ON sv.id = a.server_id
          WHERE x.deployment_id = @id ORDER BY a.username`,
        { id }
      );
      const keys = await query<{ key_label: string }>(
        "SELECT key_label FROM deployment_credentials_vault WHERE deployment_id = @id ORDER BY key_label",
        { id }
      );
      return {
        kind,
        name: `${row.company_name} • ${row.solution_name}`,
        groups: [
          ...liveStatus(row.deployment_status, row.client_id),
          ...group(ACCESS_GROUP, HINTS.deploymentAccess, access.map((a) => ({ label: a.username, detail: joinParts(a.full_name, a.server_name), href: `/employees/${a.employee_id}` }))),
          ...group("Vault keys", HINTS.deploymentVault, keys.map((k) => ({ label: k.key_label, href: `/clients/${row.client_id}` }))),
        ],
      };
    }
    case "employee": {
      const row = (await query<{ full_name: string }>("SELECT full_name FROM employees WHERE id = @id", { id }))[0];
      if (!row) return null;
      const accounts = await query<{ username: string; server_name: string }>(
        `SELECT a.username, sv.server_name FROM server_accounts a
           JOIN servers sv ON sv.id = a.server_id
          WHERE a.employee_id = @id ORDER BY sv.server_name`,
        { id }
      );
      return {
        kind,
        name: row.full_name,
        groups: group("Server accounts", HINTS.employeeAccounts, accounts.map((a) => ({ label: a.username, detail: `on ${a.server_name}`, href: `/employees/${id}` }))),
      };
    }
    case "account": {
      const row = (await query<{ username: string; employee_id: string }>("SELECT username, employee_id FROM server_accounts WHERE id = @id", { id }))[0];
      if (!row) return null;
      const access = await query<{ company_name: string; solution_name: string; database_name: string | null; environment: string }>(
        `SELECT c.company_name, s.name AS solution_name, d.database_name, d.environment
           FROM server_account_deployments x
           JOIN client_deployments d ON d.id = x.deployment_id
           JOIN clients c   ON c.id = d.client_id
           JOIN solutions s ON s.id = d.solution_id
          WHERE x.account_id = @id ORDER BY c.company_name, s.name`,
        { id }
      );
      return {
        kind,
        name: row.username,
        groups: group("Can open", HINTS.accountAccess, access.map((a) => ({
          label: `${a.company_name} • ${a.solution_name}`,
          detail: joinParts(a.database_name, a.environment),
          href: `/employees/${row.employee_id}`,
        }))),
      };
    }
  }
}

/** Without a database the demo data has no employees, so only deployments can use something. */
async function memoryUsage(kind: UsageKind, id: string): Promise<ItemUsage | null> {
  const same = (a?: string | null) => !!a && a.toLowerCase() === id.toLowerCase();
  const listDeployments = async (match: (d: { client_id: string; solution_id: string; server_id?: string | null }) => boolean) =>
    (await getDeployments()).filter(match).map((d): UsageItem => ({
      label: `${d.client?.company_name || "Company"} • ${d.solution?.name || "Solution"}`,
      detail: joinParts(d.database_name, d.environment, d.server?.server_name),
      href: `/clients/${d.client_id}`,
    }));

  switch (kind) {
    case "solution": {
      const row = (await getSolutions()).find((s) => same(s.id));
      if (!row) return null;
      return { kind, name: row.name, groups: group("Deployments", HINTS.solutionDeployments, await listDeployments((d) => same(d.solution_id))) };
    }
    case "company": {
      const row = await getClientById(id);
      if (!row) return null;
      return { kind, name: row.company_name, groups: group("Deployments", HINTS.companyDeployments, await listDeployments((d) => same(d.client_id))) };
    }
    case "server": {
      const row = (await getServers()).find((s) => same(s.id));
      if (!row) return null;
      return { kind, name: row.server_name, groups: group("Deployments", HINTS.serverDeployments, await listDeployments((d) => same(d.server_id))) };
    }
    case "deployment": {
      const row = await getDeploymentById(id);
      if (!row) return null;
      const keys = (row.credentials || []).map((c): UsageItem => ({ label: c.key_label, href: `/clients/${row.client_id}` }));
      return {
        kind,
        name: `${row.client?.company_name || "Company"} • ${row.solution?.name || "Solution"}`,
        groups: [...liveStatus(row.deployment_status, row.client_id), ...group("Vault keys", HINTS.deploymentVault, keys)],
      };
    }
    case "employee":
    case "account":
      throw new DbUnavailableError(); // employees and their accounts need SQL Server
  }
}

/** null = the item does not exist. */
export async function findUsage(kind: UsageKind, id: string): Promise<ItemUsage | null> {
  return (await dbAvailable()) ? sqlUsage(kind, id) : memoryUsage(kind, id);
}
