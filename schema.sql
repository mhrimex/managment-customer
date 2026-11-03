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
-- 5. DEFAULT STAFF ACCOUNTS
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
