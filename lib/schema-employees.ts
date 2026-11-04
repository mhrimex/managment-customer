// Auto-upgrade for existing databases: same SQL as section 5 of schema.sql.
// Batches are separated by GO lines (CREATE TRIGGER/VIEW/PROCEDURE must be first in a batch).
export const EMPLOYEES_SCHEMA_SQL = `
-- Table: employees (people who log in to the systems hosted on your servers)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='employees' AND xtype='U')
CREATE TABLE employees (
    id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    full_name   NVARCHAR(255) NOT NULL,
    job_title   NVARCHAR(150) NULL,
    email       NVARCHAR(255) NULL,
    phone       NVARCHAR(50)  NULL,
    -- the company the person works for (optional). No cascade: deleting a client
    -- clears this link in the app instead of deleting the employee.
    client_id   UNIQUEIDENTIFIER NULL REFERENCES clients(id),
    notes       NVARCHAR(MAX) NULL,
    is_active   BIT NOT NULL DEFAULT 1,
    created_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- Table: server_accounts (one login on one server; the same username may exist on other servers)
-- server_id has no cascade: SQL Server forbids a second cascade path to
-- server_account_deployments, so the app deletes a server's accounts itself.
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='server_accounts' AND xtype='U')
CREATE TABLE server_accounts (
    id           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    employee_id  UNIQUEIDENTIFIER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    server_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_server_accounts_server REFERENCES servers(id),
    username     NVARCHAR(150) NOT NULL,
    password_enc NVARCHAR(MAX) NULL,          -- AES-256-GCM, same as the vault
    is_active    BIT NOT NULL DEFAULT 1,
    notes        NVARCHAR(MAX) NULL,
    created_at   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT ux_server_accounts_server_username UNIQUE (server_id, username)
);
GO

-- Upgrade: older databases had ON DELETE CASCADE on server_accounts.server_id
DECLARE @fk SYSNAME;
SELECT @fk = fk.name
  FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fc ON fc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fc.parent_object_id AND c.column_id = fc.parent_column_id
 WHERE fk.parent_object_id = OBJECT_ID('server_accounts') AND c.name = 'server_id' AND fk.delete_referential_action <> 0;
IF @fk IS NOT NULL
BEGIN
    EXEC('ALTER TABLE server_accounts DROP CONSTRAINT [' + @fk + ']');
    EXEC('ALTER TABLE server_accounts ADD CONSTRAINT fk_server_accounts_server FOREIGN KEY (server_id) REFERENCES servers(id)');
END;
GO

-- Table: server_account_deployments (which deployments an account can open:
-- one company + solution + database on the account's server)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='server_account_deployments' AND xtype='U')
CREATE TABLE server_account_deployments (
    account_id    UNIQUEIDENTIFIER NOT NULL REFERENCES server_accounts(id) ON DELETE CASCADE,
    deployment_id UNIQUEIDENTIFIER NOT NULL REFERENCES client_deployments(id) ON DELETE CASCADE,
    created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    PRIMARY KEY (account_id, deployment_id)
);
GO

-- Upgrade: access used to be per company. Keep it: an account that had a company
-- gets all of that company's deployments on the account's server.
IF OBJECT_ID('server_account_access', 'U') IS NOT NULL
BEGIN
    EXEC('INSERT INTO server_account_deployments (account_id, deployment_id)
          SELECT DISTINCT x.account_id, d.id
            FROM server_account_access x
            JOIN server_accounts a    ON a.id = x.account_id
            JOIN client_deployments d ON d.client_id = x.client_id AND d.server_id = a.server_id
           WHERE NOT EXISTS (SELECT 1 FROM server_account_deployments n
                              WHERE n.account_id = x.account_id AND n.deployment_id = d.id)');
    DROP TABLE server_account_access;
END;
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_employees_full_name')
    CREATE INDEX idx_employees_full_name ON employees(full_name);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_employees_client_id')
    CREATE INDEX idx_employees_client_id ON employees(client_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_server_accounts_employee_id')
    CREATE INDEX idx_server_accounts_employee_id ON server_accounts(employee_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_server_accounts_username')
    CREATE INDEX idx_server_accounts_username ON server_accounts(username);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_server_account_deployments_deployment')
    CREATE INDEX idx_server_account_deployments_deployment ON server_account_deployments(deployment_id);
GO

CREATE OR ALTER TRIGGER trg_employees_updated_at
ON employees AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE employees SET updated_at = SYSUTCDATETIME()
    WHERE id IN (SELECT id FROM inserted);
END;
GO

CREATE OR ALTER TRIGGER trg_server_accounts_updated_at
ON server_accounts AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE server_accounts SET updated_at = SYSUTCDATETIME()
    WHERE id IN (SELECT id FROM inserted);
END;
GO

-- One row per (employee, server account, deployment it can open)
CREATE OR ALTER VIEW vw_server_account_access AS
SELECT
    e.id            AS employee_id,
    e.full_name     AS employee_name,
    e.job_title,
    e.is_active     AS employee_active,
    a.id            AS account_id,
    a.username,
    a.is_active     AS account_active,
    sv.id           AS server_id,
    sv.server_name,
    sv.ip_address   AS server_ip,
    d.id            AS deployment_id,
    c.id            AS client_id,
    c.company_name,
    s.name          AS solution_name,
    d.database_name,
    d.environment
FROM server_accounts a
JOIN employees e  ON e.id  = a.employee_id
JOIN servers   sv ON sv.id = a.server_id
LEFT JOIN server_account_deployments x ON x.account_id = a.id
LEFT JOIN client_deployments d ON d.id = x.deployment_id
LEFT JOIN clients   c ON c.id = d.client_id
LEFT JOIN solutions s ON s.id = d.solution_id;
GO

-- Where does a username exist, and what can it open on each server?
CREATE OR ALTER PROCEDURE sp_find_username
    @username NVARCHAR(150)
AS
BEGIN
    SET NOCOUNT ON;
    -- (FOR XML PATH instead of STRING_AGG keeps this working on SQL Server 2016)
    SELECT sv.server_name, sv.ip_address AS server_ip, a.username, e.full_name AS employee_name,
           a.is_active AS account_active,
           STUFF((SELECT N', ' + c.company_name + N' - ' + s.name
                         + COALESCE(N' (' + d.database_name + N')', N'')
                    FROM server_account_deployments x
                    JOIN client_deployments d ON d.id = x.deployment_id
                    JOIN clients c   ON c.id = d.client_id
                    JOIN solutions s ON s.id = d.solution_id
                   WHERE x.account_id = a.id
                   ORDER BY c.company_name, s.name
                   FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, N'') AS can_open
    FROM server_accounts a
    JOIN employees e  ON e.id  = a.employee_id
    JOIN servers   sv ON sv.id = a.server_id
    WHERE a.username = @username
    ORDER BY sv.server_name;
END;
GO

`;
