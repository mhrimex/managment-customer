-- =====================================================================
-- OPTIONAL demo data: 5 solutions, 4 servers, 5 clients, 6 deployments.
-- Run AFTER schema.sql.   npm run db:seed-sample   (or F5 in SSMS)
-- Do NOT run on your real production database unless you want demo rows.
-- Safe to run twice (skips if already present).
-- =====================================================================

-- @@SSMS-ONLY-BEGIN
USE client_management_db;
GO
-- @@SSMS-ONLY-END

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

-- Sample Audit Logs
IF NOT EXISTS (SELECT 1 FROM audit_logs WHERE id = '77777777-7777-7777-7777-777777777701')
INSERT INTO audit_logs (id, user_email, action, resource_type, resource_id, details, ip_address) VALUES
    ('77777777-7777-7777-7777-777777777701', 'admin@agency.com',   'LOGIN',           'USER',       '66666666-6666-6666-6666-666666666601', 'Staff administrator logged into management console', '127.0.0.1'),
    ('77777777-7777-7777-7777-777777777702', 'support@agency.com', 'VIEW_CREDENTIAL', 'CREDENTIAL', '55555555-5555-5555-5555-555555555503', 'Viewed DB Password for Acme Logistics Global',      '127.0.0.1');
GO

