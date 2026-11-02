-- =====================================================================
-- Client & Solutions Management System - SQL Server (T-SQL) Schema
-- Database: SQL Server 2016+ compatible
-- Description: Core tables, constraints, indexes, triggers, and seed data
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CREATE DATABASE (run this once as admin if needed)
-- ---------------------------------------------------------------------
-- CREATE DATABASE client_management_db;
-- GO
-- USE client_management_db;
-- GO

-- ---------------------------------------------------------------------
-- 2. CORE TABLES CREATION
-- ---------------------------------------------------------------------

-- Table: clients
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='clients' AND xtype='U')
CREATE TABLE clients (
    id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    company_name    NVARCHAR(255) NOT NULL,
    contact_person  NVARCHAR(255) NULL,
    email           NVARCHAR(255) NULL UNIQUE,
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
-- 5. SEED DATA
-- ---------------------------------------------------------------------

-- Solutions
IF NOT EXISTS (SELECT 1 FROM solutions WHERE id = '11111111-1111-1111-1111-111111111101')
INSERT INTO solutions (id, name, category, description) VALUES
    ('11111111-1111-1111-1111-111111111101', 'OmniCore ERP Suite',           'ERP',             'Enterprise Resource Planning system with Finance, HR, Supply Chain, and Inventory modules.'),
    ('11111111-1111-1111-1111-111111111102', 'Apex Retail POS',              'POS',             'Fast point-of-sale terminal software with offline sync, barcode scanning, and receipt printing.'),
    ('11111111-1111-1111-1111-111111111103', 'SwiftRoute Delivery Mobile App','MOBILE_APP',      'Real-time courier tracking, route optimization, and digital signature capture app.'),
    ('11111111-1111-1111-1111-111111111104', 'CloudPortal Custom B2B Hub',   'CUSTOM_SOFTWARE', 'Custom wholesale ordering portal integrated with SAP and external logistics providers.'),
    ('11111111-1111-1111-1111-111111111105', 'NovaStore eCommerce Engine',   'E_COMMERCE',      'Headless e-commerce storefront with high-traffic flash sale and multi-currency support.');
GO

-- Servers
IF NOT EXISTS (SELECT 1 FROM servers WHERE id = '22222222-2222-2222-2222-222222222201')
INSERT INTO servers (id, server_name, provider, ip_address, server_type, login_notes) VALUES
    ('22222222-2222-2222-2222-222222222201', 'AWS-US-East-Prod-01',      'AWS',            '54.210.142.88',  'CLOUD_VPS',  'Bastion host: bastion.prod.company.internal. Port: 2222. Key: aws-prod-key.pem'),
    ('22222222-2222-2222-2222-222222222202', 'Hetzner-EU-Dedicated-03', 'Hetzner',         '138.201.55.19', 'DEDICATED',  'SSH via root key. Proxmox VE hypervisor running isolated LXC containers.'),
    ('22222222-2222-2222-2222-222222222203', 'DO-SGP-Staging-01',       'DigitalOcean',    '128.199.202.41','CLOUD_VPS',  'Docker swarm cluster for staging environments. Floating IP enabled.'),
    ('22222222-2222-2222-2222-222222222204', 'Acme-HQ-OnPrem-Blade',    'Local Hardware',  '192.168.10.25', 'ON_PREMISE', 'Dell PowerEdge R750 located in Acme HQ Server Room A. VPN: vpn.acmecorp.com');
GO

-- Clients
IF NOT EXISTS (SELECT 1 FROM clients WHERE id = '33333333-3333-3333-3333-333333333301')
INSERT INTO clients (id, company_name, contact_person, email, phone_primary, phone_secondary, address, notes) VALUES
    ('33333333-3333-3333-3333-333333333301', 'Acme Logistics Global',  'Sarah Jenkins',         'sarah.j@acmelogistics.com',   '+1-555-019-2834',   '+1-555-019-9988',   '1400 Broadway, New York, NY 10018',              'Key enterprise client. Priority 24/7 SLA tier with dedicated Slack channel.'),
    ('33333333-3333-3333-3333-333333333302', 'Beacon Retail Group',    'Marcus Aurelius Vance', 'marcus.v@beaconretail.co.uk', '+44-20-7946-0912',  '+44-77-0090-0451',  '25 Regent Street, London W1B 2HR, UK',           'Operates 45 retail stores across UK. Running POS across all registers.'),
    ('33333333-3333-3333-3333-333333333303', 'Apex Health & Pharma',   'Dr. Elena Rostova',     'elena.rostova@apexhealth.de', '+49-30-1234-5678',  NULL,                'Friedrichstrasse 95, 10117 Berlin, Germany',     'Strict GDPR compliance and audit logging required for all deployments.'),
    ('33333333-3333-3333-3333-333333333304', 'Zenith Foods Wholesale', 'Carlos Mendoza',        'cmendoza@zenithfoods.mx',     '+52-55-5555-1234',  '+52-55-5555-4321',  'Av. Insurgentes Sur 1602, Mexico City',          'Requires bilingual support in Spanish and English.'),
    ('33333333-3333-3333-3333-333333333305', 'Pacific Horizon Media',  'David Kim',             'dkim@pacifichorizon.io',      '+1-415-555-8721',   NULL,                '500 Howard St, San Francisco, CA 94105',         'High volume media distributor. Custom cloud portal integration.');
GO

-- Client Deployments
IF NOT EXISTS (SELECT 1 FROM client_deployments WHERE id = '44444444-4444-4444-4444-444444444401')
INSERT INTO client_deployments (id, client_id, solution_id, server_id, instance_url, deployment_status, environment, database_name, version_installed, license_type, renewal_date, support_contract_status, notes) VALUES
    ('44444444-4444-4444-4444-444444444401','33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111101','22222222-2222-2222-2222-222222222201','erp.acmelogistics.com',    'ACTIVE',      'PRODUCTION','acme_erp_prod',     'v4.12.2','ANNUAL_LICENSE',       DATEADD(day,12,CAST(GETUTCDATE() AS DATE)), 'ACTIVE', 'Automated database backup nightly to AWS S3.'),
    ('44444444-4444-4444-4444-444444444402','33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111103','22222222-2222-2222-2222-222222222201','dispatch.acmelogistics.com','ACTIVE',      'PRODUCTION','acme_routes_prod',   'v2.4.0', 'MONTHLY_SUBSCRIPTION',DATEADD(day,5, CAST(GETUTCDATE() AS DATE)), 'ACTIVE', 'Push notifications handled via Firebase Cloud Messaging.'),
    ('44444444-4444-4444-4444-444444444403','33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111102','22222222-2222-2222-2222-222222222202','pos.beaconretail.co.uk',   'ACTIVE',      'PRODUCTION','beacon_pos_cluster', 'v3.8.1', 'ANNUAL_LICENSE',       DATEADD(day,24,CAST(GETUTCDATE() AS DATE)), 'ACTIVE', 'Sync daemon connects to local SQLite database when store internet drops.'),
    ('44444444-4444-4444-4444-444444444404','33333333-3333-3333-3333-333333333303','11111111-1111-1111-1111-111111111101','22222222-2222-2222-2222-222222222202','erp.apexhealth.de',        'MAINTENANCE', 'PRODUCTION','apex_erp_secure',    'v4.11.0','ANNUAL_LICENSE',       DATEADD(day,180,CAST(GETUTCDATE() AS DATE)),'ACTIVE', 'Undergoing security patch update for Q3 compliance.'),
    ('44444444-4444-4444-4444-444444444405','33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111105','22222222-2222-2222-2222-222222222203','b2b.zenithfoods.mx',       'SUSPENDED',   'STAGING',   'zenith_staging_db',  'v1.2.0', 'MONTHLY_SUBSCRIPTION',DATEADD(day,-10,CAST(GETUTCDATE() AS DATE)),'EXPIRED','Account on hold awaiting invoice settlement for July.'),
    ('44444444-4444-4444-4444-444444444406','33333333-3333-3333-3333-333333333305','11111111-1111-1111-1111-111111111104','22222222-2222-2222-2222-222222222201','hub.pacifichorizon.io',    'ACTIVE',      'PRODUCTION','pacific_hub_prod',   'v2.1.0', 'ONE_TIME_PERPETUAL',  NULL,                                       'ACTIVE', 'Perpetual license with annual maintenance SLA renewed on Jan 1.');
GO

-- Default Staff Users (Passwords: Admin123! and Support123!)
IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@agency.com')
INSERT INTO users (id, name, email, password_hash, role) VALUES
    ('66666666-6666-6666-6666-666666666601', 'Alex Mercer', 'admin@agency.com',   'admin_hash_placeholder',   'ADMIN'),
    ('66666666-6666-6666-6666-666666666602', 'Jordan Lee',  'support@agency.com', 'support_hash_placeholder', 'SUPPORT_ENGINEER');
GO

-- Sample Audit Logs
IF NOT EXISTS (SELECT 1 FROM audit_logs WHERE id = '77777777-7777-7777-7777-777777777701')
INSERT INTO audit_logs (id, user_email, action, resource_type, resource_id, details, ip_address) VALUES
    ('77777777-7777-7777-7777-777777777701', 'admin@agency.com',   'LOGIN',           'USER',       '66666666-6666-6666-6666-666666666601', 'Staff administrator logged into management console', '127.0.0.1'),
    ('77777777-7777-7777-7777-777777777702', 'support@agency.com', 'VIEW_CREDENTIAL', 'CREDENTIAL', '55555555-5555-5555-5555-555555555503', 'Viewed DB Password for Acme Logistics Global',      '127.0.0.1');
GO

-- =====================================================================
-- End of Schema & Seed Data
-- =====================================================================
