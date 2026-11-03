// Auto-upgrade for existing databases: same SQL as section 5 of schema.sql.
// Batches are separated by GO lines (CREATE TRIGGER must be first in its batch).
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
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='server_accounts' AND xtype='U')
CREATE TABLE server_accounts (
    id           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    employee_id  UNIQUEIDENTIFIER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    server_id    UNIQUEIDENTIFIER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    username     NVARCHAR(150) NOT NULL,
    password_enc NVARCHAR(MAX) NULL,          -- AES-256-GCM, same as the vault
    is_active    BIT NOT NULL DEFAULT 1,
    notes        NVARCHAR(MAX) NULL,
    created_at   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT ux_server_accounts_server_username UNIQUE (server_id, username)
);
GO

-- Table: server_account_access (which companies an account can open on its server)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='server_account_access' AND xtype='U')
CREATE TABLE server_account_access (
    account_id  UNIQUEIDENTIFIER NOT NULL REFERENCES server_accounts(id) ON DELETE CASCADE,
    client_id   UNIQUEIDENTIFIER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    created_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    PRIMARY KEY (account_id, client_id)
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_employees_full_name')
    CREATE INDEX idx_employees_full_name ON employees(full_name);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_employees_client_id')
    CREATE INDEX idx_employees_client_id ON employees(client_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_server_accounts_employee_id')
    CREATE INDEX idx_server_accounts_employee_id ON server_accounts(employee_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_server_accounts_username')
    CREATE INDEX idx_server_accounts_username ON server_accounts(username);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_server_account_access_client_id')
    CREATE INDEX idx_server_account_access_client_id ON server_account_access(client_id);
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

`;
