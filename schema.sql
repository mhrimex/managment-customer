-- =====================================================================
-- Client & Solutions Management System - SQL Server (T-SQL) Schema
-- SQL Server 2016+ / Azure SQL compatible. Safe to run again (idempotent).
--
-- HOW TO RUN
--   Option A (recommended):  npm run db:init
--       Uses DATABASE_URL from .env, creates the database if missing,
--       then runs this file.
--   Option B:  open this file in SQL Server Management Studio and press F5.
--       Change the database name below if yours is different.
--
-- Creates: database, 8 tables, indexes, updated_at triggers, 1 view,
-- 6 stored procedures, 2 default staff accounts.
--
-- Demo data (sample clients/servers/deployments) is NOT in this file.
-- It is in seed-sample-data.sql  ->  npm run db:seed-sample
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CREATE DATABASE  (SSMS only; npm run db:init handles this itself)
-- ---------------------------------------------------------------------
-- @@SSMS-ONLY-BEGIN
IF DB_ID(N'client_management_db') IS NULL
    CREATE DATABASE client_management_db;
GO
USE client_management_db;
GO
-- @@SSMS-ONLY-END

-- ---------------------------------------------------------------------
-- 2. CORE TABLES CREATION
-- ---------------------------------------------------------------------

-- Table: clients
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='clients' AND xtype='U')
CREATE TABLE clients (
    id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    company_name    NVARCHAR(255) NOT NULL,
    contact_person  NVARCHAR(255) NULL,
    email           NVARCHAR(255) NULL, -- not unique: one contact may own several companies
    phone_primary   NVARCHAR(50)  NULL,
    phone_secondary NVARCHAR(50)  NULL,
    address         NVARCHAR(MAX) NULL,
    notes           NVARCHAR(MAX) NULL,
    logo_url        NVARCHAR(MAX) NULL,
    created_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- Table: solutions
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='solutions' AND xtype='U')
CREATE TABLE solutions (
    id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name        NVARCHAR(255) NOT NULL,
    category    NVARCHAR(50)  NOT NULL DEFAULT 'CUSTOM_SOFTWARE'
                    CONSTRAINT chk_solution_category CHECK (
                        category IN ('ERP','POS','MOBILE_APP','CUSTOM_SOFTWARE','E_COMMERCE','OTHER')
                    ),
    description NVARCHAR(MAX) NULL,
    created_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- Table: servers
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='servers' AND xtype='U')
CREATE TABLE servers (
    id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    server_name NVARCHAR(255) NOT NULL,
    provider    NVARCHAR(100) NOT NULL,
    ip_address  NVARCHAR(45)  NOT NULL,
    server_type NVARCHAR(50)  NOT NULL DEFAULT 'CLOUD_VPS'
                    CONSTRAINT chk_server_type CHECK (
                        server_type IN ('CLOUD_VPS','DEDICATED','SHARED','ON_PREMISE')
                    ),
    login_notes NVARCHAR(MAX) NULL,
    created_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- Table: client_deployments (Junction Table)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='client_deployments' AND xtype='U')
CREATE TABLE client_deployments (
    id                      UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    client_id               UNIQUEIDENTIFIER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    solution_id             UNIQUEIDENTIFIER NOT NULL REFERENCES solutions(id),
    server_id               UNIQUEIDENTIFIER NULL REFERENCES servers(id) ON DELETE SET NULL,
    instance_url            NVARCHAR(255) NULL,
    deployment_status       NVARCHAR(50)  NOT NULL DEFAULT 'ACTIVE'
                                CONSTRAINT chk_deployment_status CHECK (
                                    deployment_status IN ('ACTIVE','MAINTENANCE','SUSPENDED','DECOMMISSIONED')
                                ),
    environment             NVARCHAR(50)  NOT NULL DEFAULT 'PRODUCTION'
                                CONSTRAINT chk_environment CHECK (
                                    environment IN ('PRODUCTION','STAGING','TEST')
                                ),
    database_name           NVARCHAR(100) NULL,
    version_installed       NVARCHAR(50)  NULL,
    license_type            NVARCHAR(50)  NOT NULL DEFAULT 'ANNUAL_LICENSE'
                                CONSTRAINT chk_license_type CHECK (
                                    license_type IN ('MONTHLY_SUBSCRIPTION','ANNUAL_LICENSE','ONE_TIME_PERPETUAL')
                                ),
    renewal_date            DATE          NULL,
    support_contract_status NVARCHAR(50)  NOT NULL DEFAULT 'ACTIVE'
                                CONSTRAINT chk_support_status CHECK (
                                    support_contract_status IN ('ACTIVE','EXPIRED','NO_CONTRACT')
                                ),
    notes                   NVARCHAR(MAX) NULL,
    created_at              DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at              DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- Table: deployment_credentials_vault
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='deployment_credentials_vault' AND xtype='U')
CREATE TABLE deployment_credentials_vault (
    id            UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    deployment_id UNIQUEIDENTIFIER NOT NULL REFERENCES client_deployments(id) ON DELETE CASCADE,
    key_label     NVARCHAR(100) NOT NULL,
    key_value     NVARCHAR(MAX) NOT NULL,
    created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- Table: users (Agency Staff & RBAC)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
CREATE TABLE users (
    id            UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name          NVARCHAR(100) NOT NULL,
    email         NVARCHAR(255) NOT NULL UNIQUE,
    password_hash NVARCHAR(512) NOT NULL,
    role          NVARCHAR(50)  NOT NULL DEFAULT 'SUPPORT_ENGINEER'
                      CONSTRAINT chk_user_role CHECK (
                          role IN ('ADMIN','SUPPORT_ENGINEER')
                      ),
    created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- Table: audit_logs (Security & Credential Access Tracking)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='audit_logs' AND xtype='U')
CREATE TABLE audit_logs (
    id            UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id       UNIQUEIDENTIFIER NULL REFERENCES users(id) ON DELETE SET NULL,
    user_email    NVARCHAR(255) NOT NULL,
    action        NVARCHAR(100) NOT NULL,
    resource_type NVARCHAR(100) NOT NULL,
    resource_id   NVARCHAR(255) NULL,
    details       NVARCHAR(MAX) NULL,
    ip_address    NVARCHAR(50)  NULL,
    created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- Table: app_meta (internal key/value flags used by the application)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='app_meta' AND xtype='U')
CREATE TABLE app_meta (
    [key]      NVARCHAR(100) NOT NULL PRIMARY KEY,
    value      NVARCHAR(MAX) NULL,
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- ---------------------------------------------------------------------
-- 3. PERFORMANCE INDEXES
-- ---------------------------------------------------------------------

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_clients_company_name')
    CREATE INDEX idx_clients_company_name ON clients(company_name);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_clients_email')
    CREATE INDEX idx_clients_email ON clients(email);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_clients_phone')
    CREATE INDEX idx_clients_phone ON clients(phone_primary);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_solutions_category')
    CREATE INDEX idx_solutions_category ON solutions(category);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_servers_provider')
    CREATE INDEX idx_servers_provider ON servers(provider);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_servers_ip')
    CREATE INDEX idx_servers_ip ON servers(ip_address);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_deployments_client_id')
    CREATE INDEX idx_deployments_client_id ON client_deployments(client_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_deployments_solution_id')
    CREATE INDEX idx_deployments_solution_id ON client_deployments(solution_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_deployments_server_id')
    CREATE INDEX idx_deployments_server_id ON client_deployments(server_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_deployments_status')
    CREATE INDEX idx_deployments_status ON client_deployments(deployment_status);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_deployments_renewal_date')
    CREATE INDEX idx_deployments_renewal_date ON client_deployments(renewal_date);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_vault_deployment_id')
    CREATE INDEX idx_vault_deployment_id ON deployment_credentials_vault(deployment_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_users_email')
    CREATE INDEX idx_users_email ON users(email);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_audit_logs_user_email')
    CREATE INDEX idx_audit_logs_user_email ON audit_logs(user_email);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_audit_logs_action')
    CREATE INDEX idx_audit_logs_action ON audit_logs(action);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_audit_logs_created_at')
    CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
GO

-- ---------------------------------------------------------------------
-- 4. AUTOMATIC updated_at TRIGGERS
-- ---------------------------------------------------------------------

CREATE OR ALTER TRIGGER trg_clients_updated_at
ON clients AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE clients SET updated_at = SYSUTCDATETIME()
    WHERE id IN (SELECT id FROM inserted);
END;
GO

CREATE OR ALTER TRIGGER trg_solutions_updated_at
ON solutions AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE solutions SET updated_at = SYSUTCDATETIME()
    WHERE id IN (SELECT id FROM inserted);
END;
GO

CREATE OR ALTER TRIGGER trg_servers_updated_at
ON servers AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE servers SET updated_at = SYSUTCDATETIME()
    WHERE id IN (SELECT id FROM inserted);
END;
GO

CREATE OR ALTER TRIGGER trg_deployments_updated_at
ON client_deployments AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE client_deployments SET updated_at = SYSUTCDATETIME()
    WHERE id IN (SELECT id FROM inserted);
END;
GO

CREATE OR ALTER TRIGGER trg_vault_updated_at
ON deployment_credentials_vault AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE deployment_credentials_vault SET updated_at = SYSUTCDATETIME()
    WHERE id IN (SELECT id FROM inserted);
END;
GO

CREATE OR ALTER TRIGGER trg_users_updated_at
ON users AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE users SET updated_at = SYSUTCDATETIME()
    WHERE id IN (SELECT id FROM inserted);
END;
GO

-- ---------------------------------------------------------------------
-- 5. VIEWS & STORED PROCEDURES
--    For reports, Excel/Power BI, and maintenance jobs. The web app does
--    not depend on them; it queries the tables directly.
-- ---------------------------------------------------------------------

-- One row per deployment with client, solution and server names
CREATE OR ALTER VIEW vw_deployment_details AS
SELECT
    d.id                      AS deployment_id,
    c.id                      AS client_id,
    c.company_name,
    c.contact_person,
    c.email                   AS client_email,
    c.phone_primary,
    s.name                    AS solution_name,
    s.category                AS solution_category,
    sv.server_name,
    sv.provider               AS server_provider,
    sv.ip_address             AS server_ip,
    d.instance_url,
    d.environment,
    d.deployment_status,
    d.database_name,
    d.version_installed,
    d.license_type,
    d.renewal_date,
    DATEDIFF(day, CAST(SYSUTCDATETIME() AS DATE), d.renewal_date) AS days_to_renewal,
    d.support_contract_status,
    d.created_at,
    d.updated_at
FROM client_deployments d
JOIN clients   c  ON c.id  = d.client_id
JOIN solutions s  ON s.id  = d.solution_id
LEFT JOIN servers sv ON sv.id = d.server_id;
GO

-- Headline numbers (same as the dashboard cards)
CREATE OR ALTER PROCEDURE sp_get_dashboard_stats
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @today DATE = CAST(SYSUTCDATETIME() AS DATE);
    SELECT
        (SELECT COUNT(*) FROM clients)                                                       AS total_clients,
        (SELECT COUNT(*) FROM client_deployments)                                            AS total_deployments,
        (SELECT COUNT(*) FROM client_deployments WHERE deployment_status = 'ACTIVE')         AS active_deployments,
        (SELECT COUNT(*) FROM servers)                                                       AS total_servers,
        (SELECT COUNT(*) FROM solutions)                                                     AS total_solutions,
        (SELECT COUNT(*) FROM client_deployments
          WHERE renewal_date BETWEEN @today AND DATEADD(day, 30, @today))                   AS renewals_next_30_days,
        (SELECT COUNT(*) FROM client_deployments WHERE renewal_date < @today)                AS expired_licenses;
END;
GO

-- Licenses renewing within @days (default 30). @include_expired = 1 also lists overdue ones.
CREATE OR ALTER PROCEDURE sp_get_upcoming_renewals
    @days            INT = 30,
    @include_expired BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @today DATE = CAST(SYSUTCDATETIME() AS DATE);
    SELECT company_name, contact_person, client_email, phone_primary,
           solution_name, instance_url, environment, license_type,
           renewal_date, days_to_renewal, support_contract_status
    FROM vw_deployment_details
    WHERE renewal_date IS NOT NULL
      AND renewal_date <= DATEADD(day, @days, @today)
      AND (@include_expired = 1 OR renewal_date >= @today)
    ORDER BY renewal_date ASC;
END;
GO

-- Find clients / deployments by name, contact, email, phone, domain, IP or database name
CREATE OR ALTER PROCEDURE sp_search
    @term NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @like NVARCHAR(210) = N'%' + LTRIM(RTRIM(@term)) + N'%';

    SELECT 'CLIENT' AS kind, c.id, c.company_name AS title,
           CONCAT(c.contact_person, N' ', c.email, N' ', c.phone_primary) AS details
    FROM clients c
    WHERE c.company_name LIKE @like OR c.contact_person LIKE @like OR c.email LIKE @like
       OR c.phone_primary LIKE @like OR c.phone_secondary LIKE @like
    UNION ALL
    SELECT 'DEPLOYMENT', v.deployment_id, CONCAT(v.company_name, N' - ', v.solution_name),
           CONCAT(v.instance_url, N' ', v.server_ip, N' ', v.database_name)
    FROM vw_deployment_details v
    WHERE v.instance_url LIKE @like OR v.server_ip LIKE @like OR v.database_name LIKE @like
       OR v.server_name LIKE @like OR v.solution_name LIKE @like
    ORDER BY kind, title;
END;
GO

-- Everything about one client: details, then its deployments
CREATE OR ALTER PROCEDURE sp_get_client_summary
    @client_id UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT id, company_name, contact_person, email, phone_primary, phone_secondary, address, notes, created_at
    FROM clients WHERE id = @client_id;

    SELECT solution_name, solution_category, server_name, server_ip, instance_url, environment,
           deployment_status, database_name, version_installed, license_type, renewal_date,
           days_to_renewal, support_contract_status
    FROM vw_deployment_details
    WHERE client_id = @client_id
    ORDER BY solution_name;
END;
GO

-- Deployments per server (capacity overview)
CREATE OR ALTER PROCEDURE sp_get_server_usage
AS
BEGIN
    SET NOCOUNT ON;
    SELECT sv.server_name, sv.provider, sv.ip_address, sv.server_type,
           COUNT(d.id)                                                  AS deployments,
           SUM(CASE WHEN d.deployment_status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_deployments,
           COUNT(DISTINCT d.client_id)                                  AS clients
    FROM servers sv
    LEFT JOIN client_deployments d ON d.server_id = sv.id
    GROUP BY sv.id, sv.server_name, sv.provider, sv.ip_address, sv.server_type
    ORDER BY deployments DESC, sv.server_name;
END;
GO

-- Housekeeping: delete audit-log entries older than @keep_days (default 365). Returns rows deleted.
CREATE OR ALTER PROCEDURE sp_purge_old_audit_logs
    @keep_days INT = 365
AS
BEGIN
    SET NOCOUNT ON;
    IF @keep_days < 30
    BEGIN
        RAISERROR('keep_days must be at least 30', 16, 1);
        RETURN;
    END;
    DELETE FROM audit_logs WHERE created_at < DATEADD(day, -@keep_days, SYSUTCDATETIME());
    SELECT @@ROWCOUNT AS deleted_rows;
END;
GO

-- ---------------------------------------------------------------------
-- 6. DEFAULT STAFF ACCOUNTS
--    admin@agency.com / Admin123!      (ADMIN)
--    support@agency.com / Support123!  (SUPPORT_ENGINEER)
--    CHANGE BOTH PASSWORDS after first login: Users page -> edit user.
-- ---------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@agency.com')
INSERT INTO users (id, name, email, password_hash, role) VALUES
    ('66666666-6666-6666-6666-666666666601', 'Alex Mercer', 'admin@agency.com',   'admin_hash_placeholder',   'ADMIN'),
    ('66666666-6666-6666-6666-666666666602', 'Jordan Lee',  'support@agency.com', 'support_hash_placeholder', 'SUPPORT_ENGINEER');
GO

-- Fresh install: nothing to import from the old in-memory store.
IF NOT EXISTS (SELECT 1 FROM app_meta WHERE [key] = 'memory_import_v1')
INSERT INTO app_meta ([key], value) VALUES ('memory_import_v1', '{"fresh_install":true}');
GO

-- =====================================================================
-- End of schema
-- =====================================================================
