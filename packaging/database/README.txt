CLIENT MANAGEMENT PORTAL - DATABASE  (step 1 of 3)
===================================================

Microsoft SQL Server 2016 or newer (Express is fine).

FILES
  full-database.sql      ONE script that creates EVERYTHING:
                           database client_management_db
                           8 tables, indexes, updated_at triggers
                           view  vw_deployment_details
                           6 stored procedures (reports / maintenance)
                           2 default staff accounts
                         Safe to run again: it only adds what is missing, never deletes data.
  create-app-login.sql   optional, recommended: a SQL login just for this app (instead of "sa")
  sample-data.sql        optional demo clients / servers / deployments (not for real use)

HOW
  1. (recommended) Open create-app-login.sql in SQL Server Management Studio,
     change the password, press F5.
  2. Open full-database.sql in SQL Server Management Studio, press F5.
     If your database must have another name, change client_management_db
     at the top of the script (and in api\settings.env).
     -- or -- after filling in api\settings.env, double-click api\setup-database.cmd
  3. Continue with the api folder (api\README.txt).

DEFAULT SIGN-IN (change both passwords on the Users page right away)
  admin@agency.com   / Admin123!
  support@agency.com / Support123!

STORED PROCEDURES
  EXEC sp_get_dashboard_stats;
  EXEC sp_get_upcoming_renewals @days = 30, @include_expired = 1;
  EXEC sp_search @term = N'acme';
  EXEC sp_get_client_summary @client_id = '<client guid>';
  EXEC sp_get_server_usage;
  EXEC sp_purge_old_audit_logs @keep_days = 365;

BACKUPS
  Back up this database regularly, AND keep a copy of api\settings.env
  (ENCRYPTION_SECRET) somewhere safe. Without that key, saved vault passwords
  cannot be read, even from a backup.
