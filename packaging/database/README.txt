CLIENT MANAGEMENT PORTAL - DATABASE  (do this first)
====================================================

Microsoft SQL Server 2016 or newer (Express is fine).

FILES
  full-database.sql      ONE script that creates EVERYTHING:
                           database client_management_db
                           11 tables, indexes, updated_at triggers
                           views vw_deployment_details, vw_server_account_access
                           7 stored procedures (reports / maintenance)
                           2 default staff accounts
                         Safe to run again: only adds what is missing, never deletes data.
  create-app-login.sql   recommended: a SQL login just for this app (instead of "sa")
  sample-data.sql        optional demo clients / servers / deployments (not for real use)

HOW (SQL Server Management Studio)
  1. Open create-app-login.sql, change the password, press F5.
  2. Open full-database.sql, press F5.
     (Different database name? change client_management_db at the top of both
      scripts and in api\settings.env.)
  3. Put the same server / login / password in api\settings.env -> DATABASE_URL.

DEFAULT SIGN-IN (each one must choose a new password the first time it signs in)
  admin@agency.com   / Admin123!
  support@agency.com / Support123!

STORED PROCEDURES
  EXEC sp_get_dashboard_stats;
  EXEC sp_get_upcoming_renewals @days = 30, @include_expired = 1;
  EXEC sp_search @term = N'acme';
  EXEC sp_get_client_summary @client_id = '<client guid>';
  EXEC sp_get_server_usage;
  EXEC sp_find_username @username = N'mohamad1';
  EXEC sp_purge_old_audit_logs @keep_days = 365;

BACKUPS
  Back up this database regularly AND keep a copy of api\settings.env.
  Without its ENCRYPTION_SECRET, saved vault passwords cannot be read.
