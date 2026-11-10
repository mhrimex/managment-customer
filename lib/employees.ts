/**
 * Employees and their server accounts.
 *
 *   employee (Mohamad)
 *     └─ server account: username "mohamad1" on server Rimex  (unique per server)
 *          └─ access: Cosmea ERP, Parfum de Niche ERP  (only deployments on that server)
 *
 * Account passwords are encrypted like the vault and only returned by revealAccountPassword().
 * These features need SQL Server (no in-memory fallback).
 */
import { AccessReportRow, AccountDeployment, Employee, OtherDeployment, ServerAccount } from "@/types";
import { dbAvailable, execute, inTransaction, query } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

export class DbUnavailableError extends Error {
  constructor() {
    super("The database is not reachable");
  }
}
/** A rule was broken (bad input, duplicate username...). The message is safe to show. */
export class RuleError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

async function requireDb() {
  if (!(await dbAvailable())) throw new DbUnavailableError();
}

const bool = (v: unknown) => v === true || v === 1 || v === "1";
const clean = (v: unknown, max: number) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

// ---------------------------------------------------------------------------
// Accounts (shared loader)
// ---------------------------------------------------------------------------

interface AccountRow {
  id: string; employee_id: string; employee_name: string; employee_active: boolean | number;
  server_id: string; server_name: string; server_ip: string; username: string;
  has_password: number; is_active: boolean | number; notes: string | null;
  created_at: string; updated_at: string;
}

/** Load accounts matching a WHERE clause on server_accounts (alias a), with their companies. */
async function loadAccounts(where: string, params: Record<string, any>): Promise<ServerAccount[]> {
  const rows = await query<AccountRow>(
    `SELECT a.id, a.employee_id, e.full_name AS employee_name, e.is_active AS employee_active,
            a.server_id, sv.server_name, sv.ip_address AS server_ip, a.username,
            CASE WHEN a.password_enc IS NULL OR a.password_enc = '' THEN 0 ELSE 1 END AS has_password,
            a.is_active, a.notes, a.created_at, a.updated_at
       FROM server_accounts a
       JOIN employees e  ON e.id  = a.employee_id
       JOIN servers   sv ON sv.id = a.server_id
      WHERE ${where}
      ORDER BY sv.server_name, a.username`,
    params
  );
  if (!rows.length) return [];

  const access = await query<AccountDeployment & { account_id: string }>(
    `SELECT x.account_id, d.id, c.id AS client_id, c.company_name, s.name AS solution_name,
            d.database_name, d.environment, d.instance_url
       FROM server_account_deployments x
       JOIN client_deployments d ON d.id = x.deployment_id
       JOIN clients c   ON c.id = d.client_id
       JOIN solutions s ON s.id = d.solution_id
      WHERE x.account_id IN (SELECT a.id FROM server_accounts a JOIN employees e ON e.id = a.employee_id WHERE ${where})
      ORDER BY c.company_name, s.name`,
    params
  );
  const byAccount = new Map<string, AccountDeployment[]>();
  for (const { account_id, ...dep } of access) {
    const key = account_id.toLowerCase();
    if (!byAccount.has(key)) byAccount.set(key, []);
    byAccount.get(key)!.push(dep);
  }

  return rows.map((r) => ({
    id: r.id,
    employee_id: r.employee_id,
    employee_name: r.employee_name,
    employee_active: bool(r.employee_active),
    server_id: r.server_id,
    server_name: r.server_name,
    server_ip: r.server_ip,
    username: r.username,
    has_password: r.has_password === 1,
    is_active: bool(r.is_active),
    notes: r.notes,
    deployments: byAccount.get(r.id.toLowerCase()) || [],
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function listAccounts(filter: { server_id?: string; client_id?: string; deployment_id?: string; employee_id?: string; q?: string }) {
  await requireDb();
  const where: string[] = ["1 = 1"];
  const params: Record<string, any> = {};
  if (filter.server_id) { where.push("a.server_id = @server_id"); params.server_id = filter.server_id; }
  if (filter.employee_id) { where.push("a.employee_id = @employee_id"); params.employee_id = filter.employee_id; }
  if (filter.client_id) {
    where.push(`a.id IN (SELECT x.account_id FROM server_account_deployments x
                          JOIN client_deployments d ON d.id = x.deployment_id WHERE d.client_id = @client_id)`);
    params.client_id = filter.client_id;
  }
  if (filter.deployment_id) {
    where.push("a.id IN (SELECT account_id FROM server_account_deployments WHERE deployment_id = @deployment_id)");
    params.deployment_id = filter.deployment_id;
  }
  if (filter.q) {
    where.push("(a.username LIKE @q OR e.full_name LIKE @q)");
    params.q = `%${filter.q.trim()}%`;
  }
  return loadAccounts(where.join(" AND "), params);
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export async function listEmployees(filter: { search?: string; client_id?: string } = {}): Promise<Employee[]> {
  await requireDb();
  const where: string[] = ["1 = 1"];
  const params: Record<string, any> = {};
  if (filter.client_id) { where.push("e.client_id = @client_id"); params.client_id = filter.client_id; }
  if (filter.search) {
    where.push(`(e.full_name LIKE @q OR e.email LIKE @q OR e.phone LIKE @q OR e.job_title LIKE @q OR c.company_name LIKE @q
                 OR EXISTS (SELECT 1 FROM server_accounts a WHERE a.employee_id = e.id AND a.username LIKE @q))`);
    params.q = `%${filter.search.trim()}%`;
  }
  const rows = await query<any>(
    `SELECT e.*, c.company_name AS client_name,
            (SELECT COUNT(*) FROM server_accounts a WHERE a.employee_id = e.id) AS accounts_count
       FROM employees e
       LEFT JOIN clients c ON c.id = e.client_id
      WHERE ${where.join(" AND ")}
      ORDER BY e.full_name`,
    params
  );
  if (!rows.length) return [];

  // compact account list for the cards (server + username + companies)
  const accounts = await loadAccounts(
    `a.employee_id IN (SELECT e.id FROM employees e LEFT JOIN clients c ON c.id = e.client_id WHERE ${where.join(" AND ")})`,
    params
  );
  return rows.map((r) => ({
    ...r,
    is_active: bool(r.is_active),
    accounts: accounts.filter((a) => a.employee_id.toLowerCase() === String(r.id).toLowerCase()),
  }));
}

export async function getEmployee(id: string): Promise<Employee | null> {
  await requireDb();
  const rows = await query<any>(
    `SELECT e.*, c.company_name AS client_name FROM employees e LEFT JOIN clients c ON c.id = e.client_id WHERE e.id = @id`,
    { id }
  );
  if (!rows.length) return null;
  const accounts = await loadAccounts("a.employee_id = @id", { id });
  return { ...rows[0], is_active: bool(rows[0].is_active), accounts, accounts_count: accounts.length };
}

function employeeFields(body: any, partial: boolean) {
  const full_name = clean(body?.full_name, 255);
  if (!partial || full_name !== undefined) {
    if (!full_name) throw new RuleError("Employee name is required");
  }
  return {
    full_name,
    job_title: clean(body?.job_title, 150),
    email: clean(body?.email, 255),
    phone: clean(body?.phone, 50),
    client_id: body?.client_id === undefined ? undefined : body.client_id || null,
    notes: body?.notes === undefined ? undefined : clean(body.notes, 4000),
    is_active: body?.is_active === undefined ? undefined : bool(body.is_active) ? 1 : 0,
  };
}

export async function createEmployee(body: any): Promise<Employee> {
  await requireDb();
  const f = employeeFields(body, false);
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO employees (id, full_name, job_title, email, phone, client_id, notes, is_active)
     VALUES (@id, @full_name, @job_title, @email, @phone, @client_id, @notes, @is_active)`,
    { id, full_name: f.full_name, job_title: f.job_title ?? null, email: f.email ?? null, phone: f.phone ?? null,
      client_id: f.client_id ?? null, notes: f.notes ?? null, is_active: f.is_active ?? 1 }
  );
  return (await getEmployee(id))!;
}

export async function updateEmployee(id: string, body: any): Promise<Employee | null> {
  await requireDb();
  const f = employeeFields(body, true);
  const sets: string[] = [];
  const params: Record<string, any> = { id };
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined) continue;
    sets.push(`${k} = @${k}`);
    params[k] = v;
  }
  if (sets.length) {
    const n = await execute(`UPDATE employees SET ${sets.join(", ")} WHERE id = @id`, params);
    if (!n) return null;
  }
  return getEmployee(id);
}

/** Deletes the employee. The DELETE route refuses first while they still have server accounts. */
export async function deleteEmployee(id: string): Promise<{ deleted: boolean; name?: string; accounts: number }> {
  await requireDb();
  const rows = await query<{ full_name: string; n: number }>(
    "SELECT full_name, (SELECT COUNT(*) FROM server_accounts WHERE employee_id = @id) AS n FROM employees WHERE id = @id",
    { id }
  );
  if (!rows.length) return { deleted: false, accounts: 0 };
  await execute("DELETE FROM employees WHERE id = @id", { id }); // accounts + access cascade
  return { deleted: true, name: rows[0].full_name, accounts: rows[0].n };
}

// ---------------------------------------------------------------------------
// Server accounts
// ---------------------------------------------------------------------------

/** Deployments on a server = what an account on that server can be given access to. */
export async function deploymentsOnServer(serverId: string): Promise<AccountDeployment[]> {
  await requireDb();
  return query<AccountDeployment>(
    `SELECT d.id, c.id AS client_id, c.company_name, s.name AS solution_name,
            d.database_name, d.environment, d.instance_url
       FROM client_deployments d
       JOIN clients c   ON c.id = d.client_id
       JOIN solutions s ON s.id = d.solution_id
      WHERE d.server_id = @server_id
      ORDER BY c.company_name, s.name, d.database_name`,
    { server_id: serverId }
  );
}

/** Every other deployment, so the form can say why it can't be selected on this server. */
export async function deploymentsNotOnServer(serverId: string): Promise<OtherDeployment[]> {
  await requireDb();
  return query<OtherDeployment>(
    `SELECT d.id, c.id AS client_id, c.company_name, s.name AS solution_name,
            d.database_name, d.environment, d.instance_url, sv.server_name
       FROM client_deployments d
       JOIN clients c   ON c.id = d.client_id
       JOIN solutions s ON s.id = d.solution_id
       LEFT JOIN servers sv ON sv.id = d.server_id
      WHERE d.server_id IS NULL OR d.server_id <> @server_id
      ORDER BY c.company_name, s.name, d.database_name`,
    { server_id: serverId }
  );
}

async function checkDeployments(serverId: string, deploymentIds: unknown): Promise<string[]> {
  if (deploymentIds === undefined) return [];
  if (!Array.isArray(deploymentIds)) throw new RuleError("deployment_ids must be a list");
  const wanted = [...new Set(deploymentIds.map((x) => String(x).toLowerCase()))];
  if (!wanted.length) return [];
  const allowed = new Set((await deploymentsOnServer(serverId)).map((d) => d.id.toLowerCase()));
  if (wanted.some((id) => !allowed.has(id))) throw new RuleError("Some selected deployments are not on this server");
  return wanted;
}

/**
 * Set who can open a deployment (the company page's "Manage access"): only accounts on the
 * deployment's server. Returns the usernames added and removed, or null if it doesn't exist.
 */
export async function setDeploymentAccess(deploymentId: string, accountIds: unknown) {
  await requireDb();
  if (!Array.isArray(accountIds)) throw new RuleError("account_ids must be a list");
  const dep = (await query<{ server_id: string | null; company_name: string; solution_name: string }>(
    `SELECT d.server_id, c.company_name, s.name AS solution_name
       FROM client_deployments d
       JOIN clients c   ON c.id = d.client_id
       JOIN solutions s ON s.id = d.solution_id
      WHERE d.id = @id`,
    { id: deploymentId }
  ))[0];
  if (!dep) return null;
  if (!dep.server_id) throw new RuleError("Set this deployment's Hosting Server first");

  const onServer = new Map(
    (await query<{ id: string; username: string }>("SELECT id, username FROM server_accounts WHERE server_id = @server_id", { server_id: dep.server_id }))
      .map((a) => [a.id.toLowerCase(), a.username])
  );
  const wanted = new Set(accountIds.map((x) => String(x).toLowerCase()));
  if ([...wanted].some((id) => !onServer.has(id))) throw new RuleError("Some selected accounts are not on this deployment's server");

  const current = new Set(
    (await query<{ account_id: string }>("SELECT account_id FROM server_account_deployments WHERE deployment_id = @id", { id: deploymentId }))
      .map((r) => r.account_id.toLowerCase())
  );
  const add = [...wanted].filter((id) => !current.has(id));
  const remove = [...current].filter((id) => !wanted.has(id));

  await inTransaction(async (run) => {
    for (const account_id of remove) {
      await run("DELETE FROM server_account_deployments WHERE account_id = @account_id AND deployment_id = @deployment_id", { account_id, deployment_id: deploymentId });
    }
    for (const account_id of add) {
      await run("INSERT INTO server_account_deployments (account_id, deployment_id) VALUES (@account_id, @deployment_id)", { account_id, deployment_id: deploymentId });
    }
  });
  const usernames = (ids: string[]) => ids.map((id) => onServer.get(id) || id);
  return { name: `${dep.company_name} ${dep.solution_name}`, added: usernames(add), removed: usernames(remove) };
}

/** Every employee with every account and what it can open, one row each. Never includes passwords. */
export async function accessReport(): Promise<AccessReportRow[]> {
  await requireDb();
  const rows = await query<any>(
    `SELECT e.id AS employee_id, e.full_name AS employee_name, e.job_title, e.is_active AS employee_active,
            a.id AS account_id, a.username, a.is_active AS account_active,
            sv.server_name, sv.ip_address AS server_ip,
            d.id AS deployment_id, c.id AS client_id, c.company_name, s.name AS solution_name,
            d.database_name, d.environment, d.deployment_status
       FROM employees e
       LEFT JOIN server_accounts a ON a.employee_id = e.id
       LEFT JOIN servers sv ON sv.id = a.server_id
       LEFT JOIN server_account_deployments x ON x.account_id = a.id
       LEFT JOIN client_deployments d ON d.id = x.deployment_id
       LEFT JOIN clients c   ON c.id = d.client_id
       LEFT JOIN solutions s ON s.id = d.solution_id
      ORDER BY e.full_name, sv.server_name, a.username, c.company_name, s.name`
  );
  return rows.map((r) => ({
    ...r,
    employee_active: bool(r.employee_active),
    account_active: r.account_id ? bool(r.account_active) : null,
  }));
}

function duplicateUsername(err: any) {
  return err?.number === 2627 || err?.number === 2601;
}

export async function createAccount(body: any): Promise<ServerAccount> {
  await requireDb();
  const employee_id = String(body?.employee_id || "");
  const server_id = String(body?.server_id || "");
  const username = clean(body?.username, 150);
  if (!employee_id) throw new RuleError("employee_id is required");
  if (!server_id) throw new RuleError("Choose a server");
  if (!username) throw new RuleError("Username is required");

  const emp = await query("SELECT id FROM employees WHERE id = @id", { id: employee_id });
  if (!emp.length) throw new RuleError("Employee not found", 404);
  const srv = await query<{ server_name: string }>("SELECT server_name FROM servers WHERE id = @id", { id: server_id });
  if (!srv.length) throw new RuleError("Server not found", 404);
  const deployments = await checkDeployments(server_id, body?.deployment_ids);

  const password = typeof body?.password === "string" && body.password !== "" ? body.password : null;
  const id = crypto.randomUUID();
  try {
    await inTransaction(async (run) => {
      await run(
        `INSERT INTO server_accounts (id, employee_id, server_id, username, password_enc, is_active, notes)
         VALUES (@id, @employee_id, @server_id, @username, @password_enc, @is_active, @notes)`,
        { id, employee_id, server_id, username, password_enc: password ? encrypt(password) : null,
          is_active: body?.is_active === undefined || bool(body.is_active) ? 1 : 0, notes: clean(body?.notes, 4000) ?? null }
      );
      for (const deployment_id of deployments) {
        await run("INSERT INTO server_account_deployments (account_id, deployment_id) VALUES (@id, @deployment_id)", { id, deployment_id });
      }
    });
  } catch (err) {
    if (duplicateUsername(err)) throw new RuleError(`Username "${username}" already exists on ${srv[0].server_name}`, 409);
    throw err;
  }
  return (await loadAccounts("a.id = @id", { id }))[0];
}

/**
 * Update an account. password: undefined = keep, "" = keep, a value = replace;
 * clear_password: true removes it. deployment_ids (if given) replaces the access list.
 */
export async function updateAccount(id: string, body: any): Promise<ServerAccount | null> {
  await requireDb();
  const current = await query<{ server_id: string; username: string }>(
    "SELECT server_id, username FROM server_accounts WHERE id = @id",
    { id }
  );
  if (!current.length) return null;
  const server_id = body?.server_id ? String(body.server_id) : current[0].server_id;
  const serverChanged = server_id.toLowerCase() !== current[0].server_id.toLowerCase();
  if (serverChanged) {
    const srv = await query("SELECT id FROM servers WHERE id = @id", { id: server_id });
    if (!srv.length) throw new RuleError("Server not found", 404);
  }
  // Moving to another server: access must be re-checked against the new server
  const deployments = body?.deployment_ids !== undefined || serverChanged
    ? await checkDeployments(server_id, body?.deployment_ids ?? [])
    : undefined;

  const username = body?.username === undefined ? undefined : clean(body.username, 150);
  if (username === null) throw new RuleError("Username is required");

  const sets: string[] = [];
  const params: Record<string, any> = { id };
  if (serverChanged) { sets.push("server_id = @server_id"); params.server_id = server_id; }
  if (username !== undefined) { sets.push("username = @username"); params.username = username; }
  if (body?.is_active !== undefined) { sets.push("is_active = @is_active"); params.is_active = bool(body.is_active) ? 1 : 0; }
  if (body?.notes !== undefined) { sets.push("notes = @notes"); params.notes = clean(body.notes, 4000) ?? null; }
  if (body?.clear_password) { sets.push("password_enc = NULL"); }
  else if (typeof body?.password === "string" && body.password !== "") {
    sets.push("password_enc = @password_enc");
    params.password_enc = encrypt(body.password);
  }

  try {
    await inTransaction(async (run) => {
      if (sets.length) await run(`UPDATE server_accounts SET ${sets.join(", ")} WHERE id = @id`, params);
      if (deployments !== undefined) {
        await run("DELETE FROM server_account_deployments WHERE account_id = @id", { id });
        for (const deployment_id of deployments) {
          await run("INSERT INTO server_account_deployments (account_id, deployment_id) VALUES (@id, @deployment_id)", { id, deployment_id });
        }
      }
    });
  } catch (err) {
    if (duplicateUsername(err)) {
      throw new RuleError(`Username "${username ?? current[0].username}" already exists on that server`, 409);
    }
    throw err;
  }
  return (await loadAccounts("a.id = @id", { id }))[0] || null;
}

export async function deleteAccount(id: string): Promise<ServerAccount | null> {
  await requireDb();
  const acc = (await loadAccounts("a.id = @id", { id }))[0];
  if (!acc) return null;
  await execute("DELETE FROM server_accounts WHERE id = @id", { id }); // access rows cascade
  return acc;
}

export async function revealAccountPassword(id: string): Promise<{ account: ServerAccount; password: string | null } | null> {
  await requireDb();
  const acc = (await loadAccounts("a.id = @id", { id }))[0];
  if (!acc) return null;
  const rows = await query<{ password_enc: string | null }>("SELECT password_enc FROM server_accounts WHERE id = @id", { id });
  const enc = rows[0]?.password_enc;
  return { account: acc, password: enc ? decrypt(enc) : null };
}
