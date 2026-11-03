-- =====================================================================
-- OPTIONAL but recommended: a SQL login used only by this app (instead of "sa").
-- Run in SQL Server Management Studio as an administrator BEFORE full-database.sql
-- or setup-database.cmd. Change the password, then put the same login and
-- password in settings.env -> DATABASE_URL.
-- =====================================================================

-- 1. The database (empty)
IF DB_ID(N'client_management_db') IS NULL
    CREATE DATABASE client_management_db;
GO

-- 2. The login (server level). CHANGE THE PASSWORD.
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'app_user')
    CREATE LOGIN app_user WITH PASSWORD = N'Choose-A-Strong-Password-123!', CHECK_POLICY = ON;
GO

-- 3. The user inside the database. db_owner lets the app create/upgrade its own
--    tables when a new version starts.
USE client_management_db;
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'app_user')
    CREATE USER app_user FOR LOGIN app_user;
GO
ALTER ROLE db_owner ADD MEMBER app_user;
GO

-- settings.env then becomes:
-- DATABASE_URL="Server=localhost;Database=client_management_db;User Id=app_user;Password=Choose-A-Strong-Password-123!;TrustServerCertificate=true;Encrypt=false"
