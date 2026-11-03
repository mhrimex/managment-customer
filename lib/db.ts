import sql from "mssql";
import {
  Client,
  Solution,
  Server,
  ClientDeployment,
  DeploymentCredential,
  DeploymentFilterParams,
  DashboardMetrics,
  AutocompleteSearchResult,
  SystemBackupData,
  User,
  UserRole,
} from "@/types";
import { encrypt, decrypt } from "./crypto";
import { hashPassword } from "./auth";

// =====================================================================
// SQL Server Connection Pool Configuration (Optimized Connection Pool)
// =====================================================================

const globalPoolStore = global as unknown as {
  _mssql_pool?: sql.ConnectionPool;
  _mssql_promise?: Promise<sql.ConnectionPool>;
  _mssql_ready?: boolean;
  _mssql_migrations_v2?: Promise<void>;
};

async function getPool(): Promise<sql.ConnectionPool | null> {
  if (globalPoolStore._mssql_pool && globalPoolStore._mssql_pool.connected) {
    await runMigrations(globalPoolStore._mssql_pool);
    return globalPoolStore._mssql_pool;
  }

  if (globalPoolStore._mssql_promise) {
    try {
      return await globalPoolStore._mssql_promise;
    } catch {
      return null;
    }
  }

  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    return null;
  }

  try {
    // Connection details come only from DATABASE_URL in .env (never hard-coded).
    // Accepts "Server=...;Database=...;User Id=...;Password=..." or "mssql://user:pass@host:1433/db".
    const parsed = sql.ConnectionPool.parseConnectionString(connStr);
    globalPoolStore._mssql_promise = sql.connect({
      ...parsed,
      options: {
        enableArithAbort: true,
        ...parsed.options,
      },
      pool: {
        max: 20,
        min: 2,
        idleTimeoutMillis: 60000,
        ...parsed.pool,
      },
    });

    globalPoolStore._mssql_pool = await globalPoolStore._mssql_promise;
    globalPoolStore._mssql_ready = true;
    await runMigrations(globalPoolStore._mssql_pool);
    return globalPoolStore._mssql_pool;
  } catch (err: any) {
    console.warn("[DB] SQL Server connection failed. Using in-memory store. Error:", err.message);
    globalPoolStore._mssql_promise = undefined;
    globalPoolStore._mssql_ready = false;
    return null;
  }
}

// Lightweight, idempotent schema migrations — run once per server process
// (also covers pools that were already open before a code reload)
function runMigrations(pool: sql.ConnectionPool): Promise<void> {
  if (!globalPoolStore._mssql_migrations_v2) {
    globalPoolStore._mssql_migrations_v2 = (async () => {
      await pool.request().query(`
        IF COL_LENGTH('clients', 'logo_url') IS NULL
          ALTER TABLE clients ADD logo_url NVARCHAR(MAX) NULL;

        IF OBJECT_ID('app_meta', 'U') IS NULL
          CREATE TABLE app_meta (
            [key]      NVARCHAR(100) NOT NULL PRIMARY KEY,
            value      NVARCHAR(MAX) NULL,
            updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
          );

        -- clients.email is NOT unique: one owner/contact can run several companies
        -- (e.g. multiple companies on the same server). Drop any old uniqueness rule.
        -- (TRY/CATCH: parallel processes, e.g. build workers, may race on this)
        BEGIN TRY
          DECLARE @uq SYSNAME;
          SELECT TOP 1 @uq = kc.name
            FROM sys.key_constraints kc
            JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
            JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
           WHERE kc.parent_object_id = OBJECT_ID('clients') AND kc.type = 'UQ' AND c.name = 'email';
          IF @uq IS NOT NULL
            EXEC('ALTER TABLE clients DROP CONSTRAINT [' + @uq + ']');
          IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_clients_email' AND object_id = OBJECT_ID('clients'))
            EXEC('DROP INDEX ux_clients_email ON clients');
          IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_clients_email' AND object_id = OBJECT_ID('clients'))
            EXEC('CREATE INDEX idx_clients_email ON clients(email)');
        END TRY
        BEGIN CATCH
          -- 1913 index exists, 3701 index already dropped, 3727/3728 constraint already dropped:
          -- another process won the race
          IF ERROR_NUMBER() NOT IN (1913, 3701, 3727, 3728) THROW;
        END CATCH
      `);
      await importMemoryDataOnce(pool);
    })().catch((err: any) => {
      console.warn("[DB] Migration failed:", err.message);
      globalPoolStore._mssql_migrations_v2 = undefined; // retry on next request
    });
  }
  return globalPoolStore._mssql_migrations_v2;
}

/**
 * Deployments and vault credentials used to live only in server memory.
 * Copy anything that exists in memory but not in SQL Server into SQL Server,
 * exactly once (guarded by an app_meta marker row), so nothing is lost when
 * switching storage. Uses the pool directly to avoid re-entering getPool().
 */
async function importMemoryDataOnce(pool: sql.ConnectionPool): Promise<void> {
  const MARKER = "memory_import_v1";
  const done = await pool.request().input("k", MARKER).query("SELECT 1 AS x FROM app_meta WHERE [key] = @k");
  if (done.recordset.length > 0) return;

  const ids = async (table: string) =>
    new Set(
      (await pool.request().query(`SELECT id FROM ${table}`)).recordset.map((r: any) => String(r.id).toLowerCase())
    );
  const sqlClients = await ids("clients");
  const sqlSolutions = await ids("solutions");
  const sqlServers = await ids("servers");
  const sqlDeployments = await ids("client_deployments");
  const sqlCreds = await ids("deployment_credentials_vault");

  const store = global as unknown as { _db_deployments?: ClientDeployment[]; _db_credentials?: DeploymentCredential[] };
  let depCount = 0, credCount = 0, skipped = 0;

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    for (const d of store._db_deployments || []) {
      const id = d.id.toLowerCase();
      if (sqlDeployments.has(id)) continue;
      if (!sqlClients.has(d.client_id.toLowerCase()) || !sqlSolutions.has(d.solution_id.toLowerCase())) {
        skipped++;
        continue;
      }
      const r = new sql.Request(tx).input("id", d.id);
      const p = deploymentParams({ ...d, server_id: d.server_id && sqlServers.has(d.server_id.toLowerCase()) ? d.server_id : null });
      for (const [k, v] of Object.entries(p)) r.input(k, v);
      await r.query(
        `INSERT INTO client_deployments (id, ${DEPLOYMENT_COLUMNS.join(", ")})
         VALUES (@id, ${DEPLOYMENT_COLUMNS.map((c) => "@" + c).join(", ")})`
      );
      sqlDeployments.add(id);
      depCount++;
    }

    for (const c of store._db_credentials || []) {
      if (sqlCreds.has(c.id.toLowerCase()) || !sqlDeployments.has(c.deployment_id.toLowerCase())) continue;
      await new sql.Request(tx)
        .input("id", c.id)
        .input("deployment_id", c.deployment_id)
        .input("key_label", c.key_label)
        .input("key_value", c.key_value) // already encrypted
        .query(
          `INSERT INTO deployment_credentials_vault (id, deployment_id, key_label, key_value)
           VALUES (@id, @deployment_id, @key_label, @key_value)`
        );
      credCount++;
    }

    await new sql.Request(tx)
      .input("k", MARKER)
      .input("v", JSON.stringify({ deployments: depCount, credentials: credCount, skipped, at: new Date().toISOString() }))
      .query("INSERT INTO app_meta ([key], value) VALUES (@k, @v)");
    await tx.commit();
  } catch (err) {
    try { await tx.rollback(); } catch { /* ignore */ }
    throw err;
  }

  console.log(
    `[DB] One-time import into SQL Server: ${depCount} deployment(s), ${credCount} vault credential(s)` +
      (skipped ? `, ${skipped} skipped (client/solution not in SQL)` : "")
  );
}

// Initialize connection eagerly so it's warmed up
if (process.env.DATABASE_URL) {
  getPool().catch(() => {});
}

// Generic query helper — returns typed rows
export async function query<T = any>(
  sqlText: string,
  params: Record<string, any> = {}
): Promise<T[]> {
  const p = await getPool();
  if (!p) throw new Error("SQL Server pool not available");

  const request = new sql.Request(p);
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }

  const result = await request.query(sqlText);
  return result.recordset as T[];
}

async function dbAvailable(): Promise<boolean> {
  const p = await getPool();
  return p !== null && globalPoolStore._mssql_ready === true;
}

// =====================================================================
// In-Memory Seed Data (mirrors schema.sql seed records)
// =====================================================================

const initialSolutions: Solution[] = [
  { id: "11111111-1111-1111-1111-111111111101", name: "OmniCore ERP Suite",            category: "ERP",             description: "Enterprise Resource Planning system with Finance, HR, Supply Chain, and Inventory modules.", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "11111111-1111-1111-1111-111111111102", name: "Apex Retail POS",               category: "POS",             description: "Fast point-of-sale terminal software with offline sync, barcode scanning, and receipt printing.", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "11111111-1111-1111-1111-111111111103", name: "SwiftRoute Delivery Mobile App",category: "MOBILE_APP",      description: "Real-time courier tracking, route optimization, and digital signature capture app.", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "11111111-1111-1111-1111-111111111104", name: "CloudPortal Custom B2B Hub",    category: "CUSTOM_SOFTWARE", description: "Custom wholesale ordering portal integrated with SAP and external logistics providers.", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "11111111-1111-1111-1111-111111111105", name: "NovaStore eCommerce Engine",    category: "E_COMMERCE",      description: "Headless e-commerce storefront with high-traffic flash sale and multi-currency support.", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const initialServers: Server[] = [
  { id: "22222222-2222-2222-2222-222222222201", server_name: "AWS-US-East-Prod-01",     provider: "AWS",           ip_address: "54.210.142.88",  server_type: "CLOUD_VPS",  login_notes: "Bastion host: bastion.prod.company.internal. Port: 2222. Key: aws-prod-key.pem",                     created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "22222222-2222-2222-2222-222222222202", server_name: "Hetzner-EU-Dedicated-03", provider: "Hetzner",       ip_address: "138.201.55.19", server_type: "DEDICATED",  login_notes: "SSH via root key. Proxmox VE hypervisor running isolated LXC containers.",                              created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "22222222-2222-2222-2222-222222222203", server_name: "DO-SGP-Staging-01",       provider: "DigitalOcean",  ip_address: "128.199.202.41",server_type: "CLOUD_VPS",  login_notes: "Docker swarm cluster for staging environments. Floating IP enabled.",                                   created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "22222222-2222-2222-2222-222222222204", server_name: "Acme-HQ-OnPrem-Blade",    provider: "Local Hardware", ip_address: "192.168.10.25", server_type: "ON_PREMISE", login_notes: "Dell PowerEdge R750 located in Acme HQ Server Room A. VPN: vpn.acmecorp.com",                          created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const initialClients: Client[] = [
  { id: "33333333-3333-3333-3333-333333333301", company_name: "Acme Logistics Global",  contact_person: "Sarah Jenkins",         email: "sarah.j@acmelogistics.com",   phone_primary: "+1-555-019-2834",  phone_secondary: "+1-555-019-9988",  address: "1400 Broadway, New York, NY 10018",           notes: "Key enterprise client. Priority 24/7 SLA tier with dedicated Slack channel.", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "33333333-3333-3333-3333-333333333302", company_name: "Beacon Retail Group",    contact_person: "Marcus Aurelius Vance", email: "marcus.v@beaconretail.co.uk", phone_primary: "+44-20-7946-0912", phone_secondary: "+44-77-0090-0451", address: "25 Regent Street, London W1B 2HR, UK",        notes: "Operates 45 retail stores across UK. Running POS across all registers.",      created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "33333333-3333-3333-3333-333333333303", company_name: "Apex Health & Pharma",   contact_person: "Dr. Elena Rostova",     email: "elena.rostova@apexhealth.de", phone_primary: "+49-30-1234-5678", phone_secondary: null,               address: "Friedrichstraße 95, 10117 Berlin, Germany",   notes: "Strict GDPR compliance and audit logging required for all deployments.",      created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "33333333-3333-3333-3333-333333333304", company_name: "Zenith Foods Wholesale", contact_person: "Carlos Mendoza",        email: "cmendoza@zenithfoods.mx",     phone_primary: "+52-55-5555-1234", phone_secondary: "+52-55-5555-4321", address: "Av. Insurgentes Sur 1602, Mexico City",       notes: "Requires bilingual support in Spanish and English.",                          created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "33333333-3333-3333-3333-333333333305", company_name: "Pacific Horizon Media",  contact_person: "David Kim",             email: "dkim@pacifichorizon.io",       phone_primary: "+1-415-555-8721",  phone_secondary: null,               address: "500 Howard St, San Francisco, CA 94105",      notes: "High volume media distributor. Custom cloud portal integration.",             created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

function offsetDateDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const initialDeployments: ClientDeployment[] = [
  { id: "44444444-4444-4444-4444-444444444401", client_id: "33333333-3333-3333-3333-333333333301", solution_id: "11111111-1111-1111-1111-111111111101", server_id: "22222222-2222-2222-2222-222222222201", instance_url: "erp.acmelogistics.com",     deployment_status: "ACTIVE",      environment: "PRODUCTION", database_name: "acme_erp_prod",     version_installed: "v4.12.2", license_type: "ANNUAL_LICENSE",        renewal_date: offsetDateDays(12),  support_contract_status: "ACTIVE",  notes: "Automated database backup nightly to AWS S3 bucket.", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "44444444-4444-4444-4444-444444444402", client_id: "33333333-3333-3333-3333-333333333301", solution_id: "11111111-1111-1111-1111-111111111103", server_id: "22222222-2222-2222-2222-222222222201", instance_url: "dispatch.acmelogistics.com",deployment_status: "ACTIVE",      environment: "PRODUCTION", database_name: "acme_routes_prod",   version_installed: "v2.4.0",  license_type: "MONTHLY_SUBSCRIPTION", renewal_date: offsetDateDays(5),   support_contract_status: "ACTIVE",  notes: "Push notifications handled via Firebase Cloud Messaging.", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "44444444-4444-4444-4444-444444444403", client_id: "33333333-3333-3333-3333-333333333302", solution_id: "11111111-1111-1111-1111-111111111102", server_id: "22222222-2222-2222-2222-222222222202", instance_url: "pos.beaconretail.co.uk",    deployment_status: "ACTIVE",      environment: "PRODUCTION", database_name: "beacon_pos_cluster", version_installed: "v3.8.1",  license_type: "ANNUAL_LICENSE",        renewal_date: offsetDateDays(24),  support_contract_status: "ACTIVE",  notes: "Sync daemon connects to local SQLite database when store internet drops.", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "44444444-4444-4444-4444-444444444404", client_id: "33333333-3333-3333-3333-333333333303", solution_id: "11111111-1111-1111-1111-111111111101", server_id: "22222222-2222-2222-2222-222222222202", instance_url: "erp.apexhealth.de",        deployment_status: "MAINTENANCE", environment: "PRODUCTION", database_name: "apex_erp_secure",    version_installed: "v4.11.0", license_type: "ANNUAL_LICENSE",        renewal_date: offsetDateDays(180), support_contract_status: "ACTIVE",  notes: "Undergoing security patch update for Q3 compliance.", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "44444444-4444-4444-4444-444444444405", client_id: "33333333-3333-3333-3333-333333333304", solution_id: "11111111-1111-1111-1111-111111111105", server_id: "22222222-2222-2222-2222-222222222203", instance_url: "b2b.zenithfoods.mx",       deployment_status: "SUSPENDED",   environment: "STAGING",    database_name: "zenith_staging_db",  version_installed: "v1.2.0",  license_type: "MONTHLY_SUBSCRIPTION", renewal_date: offsetDateDays(-10), support_contract_status: "EXPIRED", notes: "Account on hold awaiting invoice settlement for July.", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "44444444-4444-4444-4444-444444444406", client_id: "33333333-3333-3333-3333-333333333305", solution_id: "11111111-1111-1111-1111-111111111104", server_id: "22222222-2222-2222-2222-222222222201", instance_url: "hub.pacifichorizon.io",    deployment_status: "ACTIVE",      environment: "PRODUCTION", database_name: "pacific_hub_prod",   version_installed: "v2.1.0",  license_type: "ONE_TIME_PERPETUAL",   renewal_date: null,                support_contract_status: "ACTIVE",  notes: "Perpetual license with annual maintenance SLA renewed on Jan 1.", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const initialCredentials: DeploymentCredential[] = [
  { id: "55555555-5555-5555-5555-555555555501", deployment_id: "44444444-4444-4444-4444-444444444401", key_label: "Admin Username", key_value: encrypt("sysadmin@acmelogistics.com"),               created_at: new Date().toISOString() },
  { id: "55555555-5555-5555-5555-555555555502", deployment_id: "44444444-4444-4444-4444-444444444401", key_label: "Database Host",  key_value: encrypt("rds-acme-prod.us-east-1.rds.amazonaws.com:5432"), created_at: new Date().toISOString() },
  { id: "55555555-5555-5555-5555-555555555503", deployment_id: "44444444-4444-4444-4444-444444444401", key_label: "DB Password",    key_value: encrypt("Acme$ecur3P@ssw0rd!2026"),                  created_at: new Date().toISOString() },
  { id: "55555555-5555-5555-5555-555555555504", deployment_id: "44444444-4444-4444-4444-444444444403", key_label: "POS Sync API Key", key_value: encrypt("pk_live_8392190840918239018401928409182"), created_at: new Date().toISOString() },
  { id: "55555555-5555-5555-5555-555555555505", deployment_id: "44444444-4444-4444-4444-444444444403", key_label: "SSH Port",       key_value: encrypt("2222"),                                     created_at: new Date().toISOString() },
];

const initialUsers: User[] = [
  { id: "66666666-6666-6666-6666-666666666601", name: "Alex Mercer", email: "admin@agency.com",   password_hash: "admin_hash_placeholder",   role: "ADMIN",            created_at: new Date(Date.now() - 3600000 * 24 * 30).toISOString(), updated_at: new Date(Date.now() - 3600000 * 24 * 30).toISOString() },
  { id: "66666666-6666-6666-6666-666666666602", name: "Jordan Lee",  email: "support@agency.com", password_hash: "support_hash_placeholder", role: "SUPPORT_ENGINEER", created_at: new Date(Date.now() - 3600000 * 24 * 15).toISOString(), updated_at: new Date(Date.now() - 3600000 * 24 * 15).toISOString() },
];

// =====================================================================
// Global In-Memory Store
// =====================================================================
const globalStore = global as unknown as {
  _db_clients?: Client[];
  _db_solutions?: Solution[];
  _db_servers?: Server[];
  _db_deployments?: ClientDeployment[];
  _db_credentials?: DeploymentCredential[];
  _db_users?: User[];
};

if (!globalStore._db_clients) globalStore._db_clients = [...initialClients];
if (!globalStore._db_solutions) globalStore._db_solutions = [...initialSolutions];
if (!globalStore._db_servers) globalStore._db_servers = [...initialServers];
if (!globalStore._db_deployments) globalStore._db_deployments = [...initialDeployments];
if (!globalStore._db_credentials) globalStore._db_credentials = [...initialCredentials];
if (!globalStore._db_users) globalStore._db_users = [...initialUsers];

// =====================================================================
// Clients
// =====================================================================

export async function getClients(params?: { search?: string }): Promise<Client[]> {
  if (await dbAvailable()) {
    try {
      let sqlText = `
        SELECT c.*, COUNT(cd.id) AS deployments_count
        FROM clients c
        LEFT JOIN client_deployments cd ON cd.client_id = c.id
      `;
      const p: Record<string, any> = {};
      if (params?.search) {
        p.search = `%${params.search}%`;
        sqlText += ` WHERE c.company_name LIKE @search OR c.contact_person LIKE @search OR c.email LIKE @search OR c.phone_primary LIKE @search`;
      }
      sqlText += ` GROUP BY c.id, c.company_name, c.contact_person, c.email, c.phone_primary, c.phone_secondary, c.address, c.notes, c.logo_url, c.created_at, c.updated_at ORDER BY c.company_name ASC`;
      return await query<Client>(sqlText, p);
    } catch { /* fallback */ }
  }

  let result = (globalStore._db_clients || []).map((c) => ({
    ...c,
    deployments_count: (globalStore._db_deployments || []).filter((d) => d.client_id === c.id).length,
  }));
  if (params?.search) {
    const q = params.search.toLowerCase().trim();
    result = result.filter((c) =>
      c.company_name.toLowerCase().includes(q) ||
      (c.contact_person && c.contact_person.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone_primary && c.phone_primary.includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    );
  }
  return result.sort((a, b) => a.company_name.localeCompare(b.company_name));
}

export async function getClientById(id: string): Promise<Client | null> {
  const deployments = await getDeployments();
  const clientDeployments = deployments.filter((d) => d.client_id.toLowerCase() === id.toLowerCase());

  if (await dbAvailable()) {
    try {
      const rows = await query<Client>("SELECT * FROM clients WHERE id = @id", { id });
      if (!rows.length) return null;
      return { ...rows[0], deployments: clientDeployments, deployments_count: clientDeployments.length };
    } catch { /* fallback */ }
  }

  const client = (globalStore._db_clients || []).find((c) => c.id === id);
  if (!client) return null;
  return { ...client, deployments: clientDeployments, deployments_count: clientDeployments.length };
}

export async function createClient(data: Partial<Client>): Promise<Client> {
  const newClient: Client = {
    id: crypto.randomUUID(),
    company_name: data.company_name || "New Client",
    contact_person: data.contact_person || null,
    email: data.email || null,
    phone_primary: data.phone_primary || null,
    phone_secondary: data.phone_secondary || null,
    address: data.address || null,
    notes: data.notes || null,
    logo_url: data.logo_url || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (await dbAvailable()) {
    try {
      await query(
        `INSERT INTO clients (id, company_name, contact_person, email, phone_primary, phone_secondary, address, notes, logo_url)
         VALUES (@id, @company_name, @contact_person, @email, @phone_primary, @phone_secondary, @address, @notes, @logo_url)`,
        {
          id: newClient.id, company_name: newClient.company_name, contact_person: newClient.contact_person,
          email: newClient.email, phone_primary: newClient.phone_primary, phone_secondary: newClient.phone_secondary,
          address: newClient.address, notes: newClient.notes, logo_url: newClient.logo_url,
        }
      );
      const rows = await query<Client>("SELECT * FROM clients WHERE id = @id", { id: newClient.id });
      return rows[0];
    } catch (err) {
      // Don't fall back to memory here: the client would vanish on restart and
      // its deployments could not be saved (foreign key). Surface the error.
      console.warn("[DB] SQL Server insert client failed", err);
      throw err;
    }
  }

  globalStore._db_clients = [newClient, ...(globalStore._db_clients || [])];
  return newClient;
}

export async function updateClient(id: string, data: Partial<Client>): Promise<Client | null> {
  if (await dbAvailable()) {
    try {
      await query(
        `UPDATE clients SET
          company_name    = COALESCE(@company_name, company_name),
          contact_person  = COALESCE(@contact_person, contact_person),
          email           = COALESCE(@email, email),
          phone_primary   = COALESCE(@phone_primary, phone_primary),
          phone_secondary = COALESCE(@phone_secondary, phone_secondary),
          address         = COALESCE(@address, address),
          notes           = COALESCE(@notes, notes),
          logo_url        = CASE WHEN @logo_clear = 1 THEN NULL ELSE COALESCE(@logo_url, logo_url) END,
          updated_at      = SYSUTCDATETIME()
         WHERE id = @id`,
        { id, company_name: data.company_name, contact_person: data.contact_person, email: data.email,
          phone_primary: data.phone_primary, phone_secondary: data.phone_secondary, address: data.address, notes: data.notes,
          // logo_url: undefined = keep, "" or null = remove, data URL = replace
          logo_url: data.logo_url || null, logo_clear: data.logo_url === "" || data.logo_url === null ? 1 : 0 }
      );
      const rows = await query<Client>("SELECT * FROM clients WHERE id = @id", { id });
      return rows[0] || null;
    } catch (err) { console.warn("[DB] SQL Server update client failed, fallback to memory", err); }
  }

  const index = (globalStore._db_clients || []).findIndex((c) => c.id === id);
  if (index === -1) return null;
  const updated: Client = { ...globalStore._db_clients![index], ...data, updated_at: new Date().toISOString() };
  if (data.logo_url === "") updated.logo_url = null;
  globalStore._db_clients![index] = updated;
  return updated;
}

export async function deleteClient(id: string): Promise<boolean> {
  if (await dbAvailable()) {
    try {
      await query("DELETE FROM clients WHERE id = @id", { id });
      return true;
    } catch { /* fallback */ }
  }

  const before = (globalStore._db_clients || []).length;
  globalStore._db_clients = (globalStore._db_clients || []).filter((c) => c.id !== id);
  globalStore._db_deployments = (globalStore._db_deployments || []).filter((d) => d.client_id !== id);
  return (globalStore._db_clients || []).length < before;
}

// =====================================================================
// Solutions
// =====================================================================

export async function getSolutions(): Promise<Solution[]> {
  if (await dbAvailable()) {
    try {
      const sqlText = `
        SELECT s.*, COUNT(cd.id) AS deployments_count
        FROM solutions s
        LEFT JOIN client_deployments cd ON cd.solution_id = s.id
        GROUP BY s.id, s.name, s.category, s.description, s.created_at, s.updated_at
        ORDER BY s.name ASC
      `;
      return await query<Solution>(sqlText);
    } catch { /* fallback */ }
  }

  return (globalStore._db_solutions || []).map((s) => ({
    ...s,
    deployments_count: (globalStore._db_deployments || []).filter((d) => d.solution_id === s.id).length,
  }));
}

export const SOLUTION_CATEGORIES = ["ERP", "POS", "MOBILE_APP", "CUSTOM_SOFTWARE", "E_COMMERCE", "OTHER"] as const;

export async function createSolution(data: Partial<Solution>): Promise<Solution> {
  const newSolution: Solution = {
    id: crypto.randomUUID(),
    name: (data.name || "").trim(),
    category: data.category || "CUSTOM_SOFTWARE",
    description: data.description?.trim() || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (await dbAvailable()) {
    await query(
      `INSERT INTO solutions (id, name, category, description) VALUES (@id, @name, @category, @description)`,
      { id: newSolution.id, name: newSolution.name, category: newSolution.category, description: newSolution.description }
    );
    const rows = await query<Solution>("SELECT * FROM solutions WHERE id = @id", { id: newSolution.id });
    return { ...rows[0], deployments_count: 0 };
  }

  globalStore._db_solutions = [...(globalStore._db_solutions || []), newSolution];
  return { ...newSolution, deployments_count: 0 };
}

export async function updateSolution(id: string, data: Partial<Solution>): Promise<Solution | null> {
  if (await dbAvailable()) {
    const affected = await execute(
      `UPDATE solutions SET
         name        = COALESCE(@name, name),
         category    = COALESCE(@category, category),
         description = @description,
         updated_at  = SYSUTCDATETIME()
       WHERE id = @id`,
      { id, name: data.name?.trim() || null, category: data.category || null, description: data.description?.trim() || null }
    );
    if (affected === 0) return null;
    const rows = await query<Solution>("SELECT * FROM solutions WHERE id = @id", { id });
    return rows[0] || null;
  }

  const index = (globalStore._db_solutions || []).findIndex((s) => s.id.toLowerCase() === id.toLowerCase());
  if (index === -1) return null;
  const current = globalStore._db_solutions![index];
  const updated: Solution = {
    ...current,
    name: data.name?.trim() || current.name,
    category: data.category || current.category,
    description: data.description?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  globalStore._db_solutions![index] = updated;
  return updated;
}

/** Deletes a solution. Refuses (returns "in_use") while deployments still use it. */
export async function deleteSolution(id: string): Promise<"deleted" | "not_found" | "in_use"> {
  if (await dbAvailable()) {
    const used = await query<{ n: number }>("SELECT COUNT(*) AS n FROM client_deployments WHERE solution_id = @id", { id });
    if (used[0].n > 0) return "in_use";
    return (await execute("DELETE FROM solutions WHERE id = @id", { id })) > 0 ? "deleted" : "not_found";
  }

  if ((globalStore._db_deployments || []).some((d) => d.solution_id.toLowerCase() === id.toLowerCase())) return "in_use";
  const before = (globalStore._db_solutions || []).length;
  globalStore._db_solutions = (globalStore._db_solutions || []).filter((s) => s.id.toLowerCase() !== id.toLowerCase());
  return (globalStore._db_solutions || []).length < before ? "deleted" : "not_found";
}

// =====================================================================
// Servers
// =====================================================================

export async function getServers(): Promise<Server[]> {
  const deployments = await getDeployments();

  if (await dbAvailable()) {
    try {
      const servers = await query<Server>("SELECT * FROM servers ORDER BY server_name ASC");
      return servers.map((s) => ({
        ...s,
        deployments_count: deployments.filter((d) => d.server_id === s.id).length,
        hosted_deployments: deployments.filter((d) => d.server_id === s.id),
      }));
    } catch { /* fallback */ }
  }

  return (globalStore._db_servers || []).map((s) => {
    const hosted = deployments.filter((d) => d.server_id === s.id);
    return { ...s, deployments_count: hosted.length, hosted_deployments: hosted };
  });
}

export async function createServer(data: Partial<Server>): Promise<Server> {
  const newServer: Server = {
    id: crypto.randomUUID(),
    server_name: data.server_name || "New Server",
    provider: data.provider || "AWS",
    ip_address: data.ip_address || "0.0.0.0",
    server_type: data.server_type || "CLOUD_VPS",
    login_notes: data.login_notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (await dbAvailable()) {
    try {
      await query(
        `INSERT INTO servers (id, server_name, provider, ip_address, server_type, login_notes)
         VALUES (@id, @server_name, @provider, @ip_address, @server_type, @login_notes)`,
        { id: newServer.id, server_name: newServer.server_name, provider: newServer.provider,
          ip_address: newServer.ip_address, server_type: newServer.server_type, login_notes: newServer.login_notes }
      );
      const rows = await query<Server>("SELECT * FROM servers WHERE id = @id", { id: newServer.id });
      return rows[0];
    } catch { /* fallback */ }
  }

  globalStore._db_servers = [...(globalStore._db_servers || []), newServer];
  return newServer;
}

// =====================================================================
// Deployments
// =====================================================================
// Stored in SQL Server (client_deployments). The in-memory store is only
// used when SQL Server is unreachable; SQL errors are NOT hidden by a
// silent fallback, so a failed save surfaces as an error instead of
// "succeeding" into memory and disappearing on restart.

const DEPLOYMENT_COLUMNS = [
  "client_id", "solution_id", "server_id", "instance_url", "deployment_status", "environment",
  "database_name", "version_installed", "license_type", "renewal_date", "support_contract_status", "notes",
] as const;

/** SQL Server returns DATE columns as JS Dates; the UI expects "YYYY-MM-DD". */
function toDateOnly(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

/** UNIQUEIDENTIFIERs come back upper-case from SQL Server; compare case-insensitively. */
function sameId(a?: string | null, b?: string | null): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

/** Run a statement and return the number of affected rows. */
async function execute(sqlText: string, params: Record<string, any> = {}): Promise<number> {
  const p = await getPool();
  if (!p) throw new Error("SQL Server pool not available");
  const request = new sql.Request(p);
  for (const [key, value] of Object.entries(params)) request.input(key, value);
  const result = await request.query(sqlText);
  return result.rowsAffected.reduce((a, b) => a + b, 0);
}

function deploymentParams(d: Partial<ClientDeployment>) {
  return {
    client_id: d.client_id,
    solution_id: d.solution_id,
    server_id: d.server_id || null,
    instance_url: d.instance_url || null,
    deployment_status: d.deployment_status || "ACTIVE",
    environment: d.environment || "PRODUCTION",
    database_name: d.database_name || null,
    version_installed: d.version_installed || null,
    license_type: d.license_type || "ANNUAL_LICENSE",
    renewal_date: toDateOnly(d.renewal_date),
    support_contract_status: d.support_contract_status || "ACTIVE",
    notes: d.notes || null,
  };
}

async function loadDeploymentsFromSql(deploymentId?: string): Promise<ClientDeployment[]> {
  const where = deploymentId ? "WHERE d.id = @id" : "";
  const params = deploymentId ? { id: deploymentId } : {};

  const rows = await query<any>(
    `SELECT d.*,
       c.company_name AS c_company_name, c.contact_person AS c_contact_person, c.email AS c_email,
       c.phone_primary AS c_phone_primary, c.phone_secondary AS c_phone_secondary,
       c.address AS c_address, c.logo_url AS c_logo_url,
       s.name AS s_name, s.category AS s_category, s.description AS s_description,
       sv.server_name AS sv_server_name, sv.provider AS sv_provider, sv.ip_address AS sv_ip_address,
       sv.server_type AS sv_server_type, sv.login_notes AS sv_login_notes
     FROM client_deployments d
     LEFT JOIN clients   c  ON c.id  = d.client_id
     LEFT JOIN solutions s  ON s.id  = d.solution_id
     LEFT JOIN servers   sv ON sv.id = d.server_id
     ${where}
     ORDER BY d.created_at DESC`,
    params
  );
  if (rows.length === 0) return [];

  const creds = await query<DeploymentCredential>(
    deploymentId
      ? "SELECT * FROM deployment_credentials_vault WHERE deployment_id = @id ORDER BY created_at ASC"
      : "SELECT * FROM deployment_credentials_vault ORDER BY created_at ASC",
    params
  );

  return rows.map((r) => ({
    id: r.id,
    client_id: r.client_id,
    solution_id: r.solution_id,
    server_id: r.server_id,
    instance_url: r.instance_url,
    deployment_status: r.deployment_status,
    environment: r.environment,
    database_name: r.database_name,
    version_installed: r.version_installed,
    license_type: r.license_type,
    renewal_date: toDateOnly(r.renewal_date),
    support_contract_status: r.support_contract_status,
    notes: r.notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
    client: r.c_company_name
      ? {
          id: r.client_id, company_name: r.c_company_name, contact_person: r.c_contact_person, email: r.c_email,
          phone_primary: r.c_phone_primary, phone_secondary: r.c_phone_secondary, address: r.c_address, logo_url: r.c_logo_url,
        }
      : undefined,
    solution: r.s_name
      ? { id: r.solution_id, name: r.s_name, category: r.s_category, description: r.s_description }
      : undefined,
    server: r.server_id && r.sv_server_name
      ? {
          id: r.server_id, server_name: r.sv_server_name, provider: r.sv_provider, ip_address: r.sv_ip_address,
          server_type: r.sv_server_type, login_notes: r.sv_login_notes,
        }
      : null,
    credentials: creds
      .filter((c) => sameId(c.deployment_id, r.id))
      .map(maskCredential),
  }));
}

function loadDeploymentsFromMemory(): ClientDeployment[] {
  const clients = globalStore._db_clients || [];
  const solutions = globalStore._db_solutions || [];
  const servers = globalStore._db_servers || [];
  const credentials = globalStore._db_credentials || [];
  return (globalStore._db_deployments || []).map((d) => ({
    ...d,
    client: clients.find((c) => sameId(c.id, d.client_id)),
    solution: solutions.find((s) => sameId(s.id, d.solution_id)),
    server: servers.find((s) => sameId(s.id, d.server_id)) || null,
    credentials: credentials
      .filter((c) => sameId(c.deployment_id, d.id))
      .map(maskCredential),
  }));
}

function applyDeploymentFilters(list: ClientDeployment[], filters?: DeploymentFilterParams): ClientDeployment[] {
  if (!filters) return list;
  let enriched = list;

  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    enriched = enriched.filter((d) =>
      d.client?.company_name.toLowerCase().includes(q) ||
      d.client?.contact_person?.toLowerCase().includes(q) ||
      d.client?.phone_primary?.includes(q) ||
      d.solution?.name.toLowerCase().includes(q) ||
      d.instance_url?.toLowerCase().includes(q) ||
      d.database_name?.toLowerCase().includes(q) ||
      d.server?.server_name.toLowerCase().includes(q) ||
      d.server?.ip_address.toLowerCase().includes(q)
    );
  }

  if (filters.solution_id && filters.solution_id !== "all") enriched = enriched.filter((d) => sameId(d.solution_id, filters.solution_id));
  if (filters.category && filters.category !== "all") enriched = enriched.filter((d) => d.solution?.category === filters.category);
  if (filters.server_id && filters.server_id !== "all") {
    enriched = filters.server_id === "none" ? enriched.filter((d) => !d.server_id) : enriched.filter((d) => sameId(d.server_id, filters.server_id));
  }
  if (filters.server_type && filters.server_type !== "all") enriched = enriched.filter((d) => d.server?.server_type === filters.server_type);
  if (filters.status && filters.status !== "all") enriched = enriched.filter((d) => d.deployment_status === filters.status);
  if (filters.environment && filters.environment !== "all") enriched = enriched.filter((d) => d.environment === filters.environment);
  if (filters.support_status && filters.support_status !== "all") enriched = enriched.filter((d) => d.support_contract_status === filters.support_status);

  if (filters.renewal_due && filters.renewal_due !== "all") {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    enriched = enriched.filter((d) => {
      if (!d.renewal_date) return false;
      const rDate = new Date(d.renewal_date); rDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((rDate.getTime() - today.getTime()) / 86400000);
      if (filters.renewal_due === "expired") return diffDays < 0;
      if (filters.renewal_due === "7")  return diffDays >= 0 && diffDays <= 7;
      if (filters.renewal_due === "30") return diffDays >= 0 && diffDays <= 30;
      if (filters.renewal_due === "90") return diffDays >= 0 && diffDays <= 90;
      return true;
    });
  }

  return enriched;
}

export async function getDeployments(filters?: DeploymentFilterParams): Promise<ClientDeployment[]> {
  const all = (await dbAvailable()) ? await loadDeploymentsFromSql() : loadDeploymentsFromMemory();
  return applyDeploymentFilters(all, filters);
}

export async function getDeploymentById(id: string): Promise<ClientDeployment | null> {
  if (await dbAvailable()) {
    const rows = await loadDeploymentsFromSql(id);
    return rows[0] || null;
  }
  return loadDeploymentsFromMemory().find((d) => sameId(d.id, id)) || null;
}

export async function createDeployment(data: Partial<ClientDeployment>): Promise<ClientDeployment> {
  const newDeployment: ClientDeployment = {
    id: crypto.randomUUID(),
    client_id: data.client_id!,
    solution_id: data.solution_id!,
    server_id: data.server_id || null,
    instance_url: data.instance_url || null,
    deployment_status: data.deployment_status || "ACTIVE",
    environment: data.environment || "PRODUCTION",
    database_name: data.database_name || null,
    version_installed: data.version_installed || "v1.0.0",
    license_type: data.license_type || "ANNUAL_LICENSE",
    renewal_date: data.renewal_date || null,
    support_contract_status: data.support_contract_status || "ACTIVE",
    notes: data.notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (await dbAvailable()) {
    await query(
      `INSERT INTO client_deployments (id, ${DEPLOYMENT_COLUMNS.join(", ")})
       VALUES (@id, ${DEPLOYMENT_COLUMNS.map((c) => "@" + c).join(", ")})`,
      { id: newDeployment.id, ...deploymentParams(newDeployment) }
    );
    return (await getDeploymentById(newDeployment.id))!;
  }

  globalStore._db_deployments = [newDeployment, ...(globalStore._db_deployments || [])];
  return (await getDeploymentById(newDeployment.id))!;
}

export async function updateDeployment(id: string, data: Partial<ClientDeployment>): Promise<ClientDeployment | null> {
  if (await dbAvailable()) {
    const existing = await getDeploymentById(id);
    if (!existing) return null;
    // Merge so omitted fields keep their value while explicit nulls clear them
    const merged = { ...existing, ...data };
    await query(
      `UPDATE client_deployments SET
         ${DEPLOYMENT_COLUMNS.map((c) => `${c} = @${c}`).join(",\n         ")},
         updated_at = SYSUTCDATETIME()
       WHERE id = @id`,
      { id, ...deploymentParams(merged) }
    );
    return getDeploymentById(id);
  }

  const index = (globalStore._db_deployments || []).findIndex((d) => sameId(d.id, id));
  if (index === -1) return null;
  globalStore._db_deployments![index] = { ...globalStore._db_deployments![index], ...data, updated_at: new Date().toISOString() };
  return getDeploymentById(id);
}

export async function deleteDeployment(id: string): Promise<boolean> {
  if (await dbAvailable()) {
    // Vault rows are removed by ON DELETE CASCADE
    return (await execute("DELETE FROM client_deployments WHERE id = @id", { id })) > 0;
  }

  const before = (globalStore._db_deployments || []).length;
  globalStore._db_deployments = (globalStore._db_deployments || []).filter((d) => !sameId(d.id, id));
  globalStore._db_credentials = (globalStore._db_credentials || []).filter((c) => !sameId(c.deployment_id, id));
  return (globalStore._db_deployments || []).length < before;
}

// =====================================================================
// Credentials (encrypted with AES-256-GCM before they are stored)
// =====================================================================

/**
 * List views never carry secret values to the browser. The value is blanked and
 * the UI calls revealCredential() (GET /api/credentials?id=...) for one key at a time.
 */
function maskCredential(c: DeploymentCredential): DeploymentCredential {
  return { ...c, key_value: "" };
}

/** Decrypt a single vault entry. Returns null when the id does not exist. */
export async function revealCredential(id: string): Promise<DeploymentCredential | null> {
  if (await dbAvailable()) {
    const rows = await query<DeploymentCredential>(
      "SELECT * FROM deployment_credentials_vault WHERE id = @id",
      { id }
    );
    return rows.length ? { ...rows[0], key_value: decrypt(rows[0].key_value) } : null;
  }
  const c = (globalStore._db_credentials || []).find((x) => sameId(x.id, id));
  return c ? { ...c, key_value: decrypt(c.key_value) } : null;
}

export async function getCredentialsForDeployment(deploymentId: string): Promise<DeploymentCredential[]> {
  if (await dbAvailable()) {
    const rows = await query<DeploymentCredential>(
      "SELECT * FROM deployment_credentials_vault WHERE deployment_id = @id ORDER BY created_at ASC",
      { id: deploymentId }
    );
    return rows.map((c) => ({ ...c, key_value: decrypt(c.key_value) }));
  }
  return (globalStore._db_credentials || [])
    .filter((c) => sameId(c.deployment_id, deploymentId))
    .map((c) => ({ ...c, key_value: decrypt(c.key_value) }));
}

export async function addCredential(deploymentId: string, keyLabel: string, keyValue: string): Promise<DeploymentCredential> {
  const newCred: DeploymentCredential = {
    id: crypto.randomUUID(), deployment_id: deploymentId, key_label: keyLabel,
    key_value: encrypt(keyValue), created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };

  if (await dbAvailable()) {
    await query(
      `INSERT INTO deployment_credentials_vault (id, deployment_id, key_label, key_value)
       VALUES (@id, @deployment_id, @key_label, @key_value)`,
      { id: newCred.id, deployment_id: deploymentId, key_label: keyLabel, key_value: newCred.key_value }
    );
    return maskCredential(newCred);
  }

  globalStore._db_credentials = [...(globalStore._db_credentials || []), newCred];
  return maskCredential(newCred);
}

export async function deleteCredential(id: string): Promise<boolean> {
  if (await dbAvailable()) {
    return (await execute("DELETE FROM deployment_credentials_vault WHERE id = @id", { id })) > 0;
  }
  const before = (globalStore._db_credentials || []).length;
  globalStore._db_credentials = (globalStore._db_credentials || []).filter((c) => !sameId(c.id, id));
  return (globalStore._db_credentials || []).length < before;
}

// =====================================================================
// Dashboard Metrics
// =====================================================================

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const clients = await getClients();
  const deployments = await getDeployments();
  const servers = await getServers();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  let expiring30Days = 0, expiredLicenses = 0, activeContracts = 0;
  const byCategory: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const upcomingRenewals: ClientDeployment[] = [];

  for (const dep of deployments) {
    const cat = dep.solution?.category || "OTHER";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    byStatus[dep.deployment_status] = (byStatus[dep.deployment_status] || 0) + 1;
    if (dep.support_contract_status === "ACTIVE") activeContracts++;
    if (dep.renewal_date) {
      const rDate = new Date(dep.renewal_date); rDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((rDate.getTime() - today.getTime()) / 86400000);
      if (diffDays < 0) { expiredLicenses++; }
      else if (diffDays <= 30) { expiring30Days++; upcomingRenewals.push(dep); }
    }
  }

  upcomingRenewals.sort((a, b) =>
    !a.renewal_date ? 1 : !b.renewal_date ? -1 : new Date(a.renewal_date).getTime() - new Date(b.renewal_date).getTime()
  );

  return {
    total_clients: clients.length, total_deployments: deployments.length, active_servers: servers.length,
    expiring_30_days: expiring30Days, expired_licenses: expiredLicenses, active_support_contracts: activeContracts,
    by_category: byCategory, by_status: byStatus, upcoming_renewals: upcomingRenewals,
  };
}

// =====================================================================
// Search
// =====================================================================

export async function searchAll(q: string): Promise<AutocompleteSearchResult> {
  const ql = q.toLowerCase().trim();
  if (!ql) return { clients: [], deployments: [], servers: [], solutions: [] };

  const clients = (await getClients())
    .filter((c) => c.company_name.toLowerCase().includes(ql) || c.contact_person?.toLowerCase().includes(ql))
    .slice(0, 5)
    .map((c) => ({ id: c.id, title: c.company_name, subtitle: c.contact_person ? `${c.contact_person} • ${c.email || ""}` : c.email || "Client", type: "client" as const }));

  const allDeployments = await getDeployments();
  const deployments = allDeployments
    .filter((d) => d.instance_url?.toLowerCase().includes(ql) || d.client?.company_name.toLowerCase().includes(ql) || d.solution?.name.toLowerCase().includes(ql) || d.database_name?.toLowerCase().includes(ql))
    .slice(0, 5)
    .map((d) => ({ id: d.id, title: d.instance_url || `${d.client?.company_name} - ${d.solution?.name}`, subtitle: `${d.solution?.name || "Solution"} • ${d.deployment_status} • ${d.environment}`, clientId: d.client_id, type: "deployment" as const }));

  const servers = (await getServers())
    .filter((s) => s.server_name.toLowerCase().includes(ql) || s.ip_address.includes(ql) || s.provider.toLowerCase().includes(ql))
    .slice(0, 5)
    .map((s) => ({ id: s.id, title: s.server_name, subtitle: `${s.provider} • ${s.ip_address} • ${s.server_type}`, type: "server" as const }));

  const solutions = (await getSolutions())
    .filter((s) => s.name.toLowerCase().includes(ql) || s.category.toLowerCase().includes(ql))
    .slice(0, 5)
    .map((s) => ({ id: s.id, title: s.name, subtitle: `${s.category} • ${s.description?.slice(0, 45) || ""}...`, type: "solution" as const }));

  return { clients, deployments, servers, solutions };
}

// =====================================================================
// Backup & Maintenance
// =====================================================================

type TxRun = (sqlText: string, params?: Record<string, any>) => Promise<void>;

/** Run several statements atomically: either all succeed or none are applied. */
async function inTransaction(work: (run: TxRun) => Promise<void>): Promise<void> {
  const p = await getPool();
  if (!p) throw new Error("SQL Server pool not available");
  const tx = new sql.Transaction(p);
  await tx.begin();
  try {
    await work(async (sqlText, params = {}) => {
      const request = new sql.Request(tx);
      for (const [key, value] of Object.entries(params)) request.input(key, value);
      await request.query(sqlText);
    });
    await tx.commit();
  } catch (err) {
    try { await tx.rollback(); } catch { /* already rolled back */ }
    throw err;
  }
}

async function txInsertSolution(run: TxRun, s: Partial<Solution>) {
  await run(
    `IF NOT EXISTS (SELECT 1 FROM solutions WHERE id = @id)
       INSERT INTO solutions (id, name, category, description) VALUES (@id, @name, @category, @description)`,
    { id: s.id, name: s.name, category: s.category || "OTHER", description: s.description || null }
  );
}

async function txInsertServer(run: TxRun, s: Partial<Server>) {
  await run(
    `INSERT INTO servers (id, server_name, provider, ip_address, server_type, login_notes)
     VALUES (@id, @server_name, @provider, @ip_address, @server_type, @login_notes)`,
    { id: s.id, server_name: s.server_name, provider: s.provider, ip_address: s.ip_address,
      server_type: s.server_type || "CLOUD_VPS", login_notes: s.login_notes || null }
  );
}

async function txInsertClient(run: TxRun, c: Partial<Client>) {
  await run(
    `INSERT INTO clients (id, company_name, contact_person, email, phone_primary, phone_secondary, address, notes, logo_url)
     VALUES (@id, @company_name, @contact_person, @email, @phone_primary, @phone_secondary, @address, @notes, @logo_url)`,
    { id: c.id, company_name: c.company_name, contact_person: c.contact_person || null, email: c.email || null,
      phone_primary: c.phone_primary || null, phone_secondary: c.phone_secondary || null,
      address: c.address || null, notes: c.notes || null, logo_url: c.logo_url || null }
  );
}

async function txInsertDeployment(run: TxRun, d: Partial<ClientDeployment>) {
  await run(
    `INSERT INTO client_deployments (id, ${DEPLOYMENT_COLUMNS.join(", ")})
     VALUES (@id, ${DEPLOYMENT_COLUMNS.map((c) => "@" + c).join(", ")})`,
    { id: d.id, ...deploymentParams(d) }
  );
}

async function txInsertCredential(run: TxRun, c: Partial<DeploymentCredential>) {
  const value = c.key_value || "";
  await run(
    `INSERT INTO deployment_credentials_vault (id, deployment_id, key_label, key_value)
     VALUES (@id, @deployment_id, @key_label, @key_value)`,
    { id: c.id || crypto.randomUUID(), deployment_id: c.deployment_id, key_label: c.key_label,
      // Backups carry ciphertext; encrypt anything that arrives as plain text
      key_value: value.startsWith("ENC(") ? value : encrypt(value) }
  );
}

export async function exportSystemBackup(): Promise<SystemBackupData> {
  const clients = await getClients();
  const solutions = await getSolutions();
  const servers = await getServers();
  const deployments = await getDeployments();
  // Credentials are exported still encrypted
  const credentials = (await dbAvailable())
    ? await query<DeploymentCredential>("SELECT * FROM deployment_credentials_vault ORDER BY created_at ASC")
    : globalStore._db_credentials || [];

  return {
    version: "1.0.0", exported_at: new Date().toISOString(),
    stats: { clients_count: clients.length, solutions_count: solutions.length, servers_count: servers.length, deployments_count: deployments.length, credentials_count: credentials.length, audit_logs_count: 0 },
    clients: clients.map(({ deployments: _d, deployments_count: _n, ...c }) => c),
    solutions: solutions.map(({ deployments_count: _n, ...s }: any) => s),
    servers: servers.map(({ deployments_count: _n, hosted_deployments: _h, ...s }) => s),
    deployments: deployments.map(({ client, solution, server, credentials: _c, ...d }) => d),
    credentials,
  };
}

export async function restoreSystemBackup(backup: Partial<SystemBackupData>): Promise<{ success: boolean; message: string }> {
  if (await dbAvailable()) {
    const clients = backup.clients || [];
    const servers = backup.servers || [];
    const backupSolutions = backup.solutions || [];
    const existingSolutionIds = (await query<{ id: string }>("SELECT id FROM solutions")).map((r) => r.id.toLowerCase());

    const clientIds = new Set(clients.map((c) => c.id.toLowerCase()));
    const serverIds = new Set(servers.map((s) => s.id.toLowerCase()));
    const solutionIds = new Set([...existingSolutionIds, ...backupSolutions.map((s) => s.id.toLowerCase())]);

    // Skip records that point at something missing from the backup, instead of failing the whole restore
    const deployments = (backup.deployments || []).filter(
      (d) => clientIds.has(String(d.client_id).toLowerCase()) && solutionIds.has(String(d.solution_id).toLowerCase())
    );
    const deploymentIds = new Set(deployments.map((d) => d.id.toLowerCase()));
    const credentials = (backup.credentials || []).filter((c) => deploymentIds.has(String(c.deployment_id).toLowerCase()));
    const skipped = (backup.deployments?.length || 0) - deployments.length;

    await inTransaction(async (run) => {
      await run("DELETE FROM deployment_credentials_vault");
      await run("DELETE FROM client_deployments");
      await run("DELETE FROM clients");
      await run("DELETE FROM servers");
      for (const s of backupSolutions) await txInsertSolution(run, s);
      for (const c of clients) await txInsertClient(run, c);
      for (const s of servers) await txInsertServer(run, s);
      for (const d of deployments) {
        await txInsertDeployment(run, {
          ...d,
          server_id: d.server_id && serverIds.has(d.server_id.toLowerCase()) ? d.server_id : null,
        });
      }
      for (const c of credentials) await txInsertCredential(run, c);
    });

    return {
      success: true,
      message: `Restored ${clients.length} clients, ${servers.length} servers, ${deployments.length} deployments and ${credentials.length} vault credentials.` +
        (skipped > 0 ? ` Skipped ${skipped} deployment(s) whose client or solution was missing from the backup.` : ""),
    };
  }

  globalStore._db_clients = backup.clients ? [...backup.clients] : [];
  globalStore._db_solutions = backup.solutions && backup.solutions.length > 0 ? [...backup.solutions] : [...initialSolutions];
  globalStore._db_servers = backup.servers ? [...backup.servers] : [];
  globalStore._db_deployments = backup.deployments ? [...backup.deployments] : [];
  globalStore._db_credentials = backup.credentials ? [...backup.credentials] : [];

  return { success: true, message: `Restored ${backup.clients?.length || 0} clients, ${backup.servers?.length || 0} servers, and ${backup.deployments?.length || 0} deployments.` };
}

export async function clearOrResetSystemData(mode: "reset_seed" | "clear_all"): Promise<{ success: boolean; message: string }> {
  if (await dbAvailable()) {
    await inTransaction(async (run) => {
      await run("DELETE FROM deployment_credentials_vault");
      await run("DELETE FROM client_deployments");
      await run("DELETE FROM clients");
      await run("DELETE FROM servers");
      if (mode === "clear_all") {
        await run("DELETE FROM solutions");
        return;
      }
      for (const s of initialSolutions) await txInsertSolution(run, s);
      for (const s of initialServers) await txInsertServer(run, s);
      for (const c of initialClients) await txInsertClient(run, c);
      for (const d of initialDeployments) await txInsertDeployment(run, d);
      for (const c of initialCredentials) await txInsertCredential(run, c);
    });
  }

  if (mode === "reset_seed") {
    globalStore._db_clients = [...initialClients];
    globalStore._db_solutions = [...initialSolutions];
    globalStore._db_servers = [...initialServers];
    globalStore._db_deployments = [...initialDeployments];
    globalStore._db_credentials = [...initialCredentials];
    return { success: true, message: "System data reset to default seed records successfully." };
  } else {
    globalStore._db_clients = [];
    globalStore._db_servers = [];
    globalStore._db_deployments = [];
    globalStore._db_credentials = [];
    globalStore._db_solutions = [];
    return { success: true, message: "All clients, servers, deployments, vault credentials, and solutions have been purged." };
  }
}

// =====================================================================
// User Management
// =====================================================================

export async function getUsers(params?: { search?: string; role?: string }): Promise<User[]> {
  if (await dbAvailable()) {
    try {
      let sqlText = "SELECT id, name, email, role, created_at, updated_at FROM users";
      const p: Record<string, any> = {};
      const conditions: string[] = [];
      if (params?.role && params.role !== "ALL") { p.role = params.role; conditions.push("role = @role"); }
      if (params?.search) { p.search = `%${params.search}%`; conditions.push("(name LIKE @search OR email LIKE @search)"); }
      if (conditions.length) sqlText += " WHERE " + conditions.join(" AND ");
      sqlText += " ORDER BY created_at ASC";
      return await query<User>(sqlText, p);
    } catch { /* fallback */ }
  }

  let result = [...(globalStore._db_users || [])];
  if (params?.role && params.role !== "ALL") result = result.filter((u) => u.role === params.role);
  if (params?.search) {
    const q = params.search.toLowerCase().trim();
    result = result.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }
  return result.map(({ password_hash, ...u }) => u as User);
}

export async function getUserById(id: string): Promise<User | null> {
  if (await dbAvailable()) {
    try {
      const rows = await query<User>("SELECT * FROM users WHERE id = @id", { id });
      if (rows.length > 0) return rows[0];
    } catch { /* fallback */ }
  }
  return (globalStore._db_users || []).find((u) => u.id === id) || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const clean = email.toLowerCase().trim();
  if (await dbAvailable()) {
    try {
      const rows = await query<User>("SELECT * FROM users WHERE LOWER(email) = @email", { email: clean });
      if (rows.length > 0) return rows[0];
    } catch { /* fallback */ }
  }
  return (globalStore._db_users || []).find((u) => u.email.toLowerCase() === clean) || null;
}

export async function getUserByEmailOrName(identifier: string): Promise<User | null> {
  const clean = identifier.trim().toLowerCase();
  if (await dbAvailable()) {
    try {
      const rows = await query<User>("SELECT * FROM users WHERE LOWER(email) = @id OR LOWER(name) = @id", { id: clean });
      if (rows.length > 0) return rows[0];
    } catch { /* fallback */ }
  }
  return (globalStore._db_users || []).find((u) => u.email.toLowerCase() === clean || u.name.toLowerCase() === clean) || null;
}

export async function createUser(data: { name: string; email: string; password: string; role: UserRole }): Promise<User> {
  const newUser: User = {
    id: crypto.randomUUID(),
    name: data.name.trim(),
    email: data.email.toLowerCase().trim(),
    password_hash: hashPassword(data.password),
    role: data.role,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (await dbAvailable()) {
    try {
      await query(
        `INSERT INTO users (id, name, email, password_hash, role) VALUES (@id, @name, @email, @password_hash, @role)`,
        { id: newUser.id, name: newUser.name, email: newUser.email, password_hash: newUser.password_hash, role: newUser.role }
      );
      const rows = await query<User>("SELECT * FROM users WHERE id = @id", { id: newUser.id });
      if (rows.length > 0) return rows[0];
    } catch (err) { console.warn("[DB] SQL Server insert user failed, fallback to memory", err); }
  }

  globalStore._db_users = [...(globalStore._db_users || []), newUser];
  return newUser;
}

export async function updateUser(id: string, data: { name?: string; email?: string; password?: string; role?: UserRole }): Promise<User | null> {
  const existing = await getUserById(id);
  if (!existing) return null;

  const newHash = data.password?.trim() ? hashPassword(data.password.trim()) : existing.password_hash;
  const cleanEmail = data.email ? data.email.toLowerCase().trim() : existing.email;
  const cleanName = data.name ? data.name.trim() : existing.name;
  const cleanRole = data.role || existing.role;

  if (await dbAvailable()) {
    try {
      await query(
        `UPDATE users SET name = @name, email = @email, password_hash = @password_hash, role = @role, updated_at = SYSUTCDATETIME() WHERE id = @id`,
        { id, name: cleanName, email: cleanEmail, password_hash: newHash, role: cleanRole }
      );
      const rows = await query<User>("SELECT * FROM users WHERE id = @id", { id });
      if (rows.length > 0) return rows[0];
    } catch { /* fallback */ }
  }

  const index = (globalStore._db_users || []).findIndex((u) => u.id === id);
  if (index === -1) return null;
  const updated: User = { ...globalStore._db_users![index], name: cleanName, email: cleanEmail, role: cleanRole, password_hash: newHash, updated_at: new Date().toISOString() };
  globalStore._db_users![index] = updated;
  return updated;
}

export async function deleteUser(id: string): Promise<boolean> {
  if (await dbAvailable()) {
    try {
      await query("DELETE FROM users WHERE id = @id", { id });
      return true;
    } catch { /* fallback */ }
  }

  const before = (globalStore._db_users || []).length;
  globalStore._db_users = (globalStore._db_users || []).filter((u) => u.id !== id);
  return (globalStore._db_users || []).length < before;
}
