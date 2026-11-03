CLIENT MANAGEMENT PORTAL - DEPLOYMENT PACKAGE
==============================================

This folder is the complete, compiled application (web pages + API in one
program). It contains no source code and needs nothing installed except
Microsoft SQL Server somewhere on the network. Node.js is included
(runtime\node.exe).

Copy the WHOLE folder to the server, e.g. C:\Apps\ClientPortal


WHAT'S IN HERE
--------------
  settings.env            <- the ONLY file you edit (database, port, secrets)
  start.cmd               run the app in a window (for a quick test)
  install-service.cmd     run as admin: start automatically with Windows
  restart-service.cmd     run as admin: restart after editing settings.env
  uninstall-service.cmd   run as admin: stop and remove the automatic start
  setup-database.cmd      create/upgrade the database from settings.env
                          (setup-database.cmd -Sample adds demo data)
  database\
     full-database.sql    ONE script that creates everything: database, tables,
                          indexes, triggers, view, stored procedures, default users
     sample-data.sql      optional demo clients/servers/deployments
     create-app-login.sql optional: a dedicated SQL login instead of "sa"
  app\                    the compiled application (don't edit)
  runtime\                Node.js (don't edit)
  logs\server.log         created when the app runs


FIRST INSTALL (5 steps)
-----------------------
1. DATABASE LOGIN (recommended)
   Open database\create-app-login.sql in SQL Server Management Studio,
   change the password, press F5.

2. SETTINGS
   Open settings.env in Notepad and set DATABASE_URL:
     Server=   your SQL Server (localhost, a PC name, or IP; add ,PORT if not 1433)
     User Id=  / Password=   the login from step 1
   Optionally change PORT (default 3000).
   Leave AUTH_SECRET / ENCRYPTION_SECRET as they are; they are generated
   automatically on the first start.

3. DATABASE
   Double-click setup-database.cmd
   (or open database\full-database.sql in SSMS and press F5).
   It is safe to run again; it never deletes data.

4. START
   Right-click install-service.cmd -> Run as administrator.
   The app now starts with Windows, restarts itself if it crashes,
   and the firewall allows other PCs on the network.
   (Just testing? Double-click start.cmd instead.)

5. SIGN IN
   http://localhost:3000   (other PCs: http://<server-ip>:3000)
   admin@agency.com / Admin123!
   support@agency.com / Support123!
   CHANGE BOTH PASSWORDS right away on the Users page.

   Then BACK UP settings.env (at least ENCRYPTION_SECRET). Without it, saved
   vault passwords cannot be read, even from a database backup.


CHANGING SETTINGS LATER
-----------------------
Edit settings.env, then run restart-service.cmd as administrator
(or close and re-open start.cmd).


UPDATING TO A NEW VERSION
-------------------------
1. uninstall-service.cmd (as admin)
2. Replace the app\ and database\ folders with the new ones.
   KEEP your settings.env.
3. setup-database.cmd
4. install-service.cmd (as admin)


DATABASE OBJECTS
----------------
Tables:  clients, solutions, servers, client_deployments,
         deployment_credentials_vault (AES-256 encrypted), users, audit_logs, app_meta
View:    vw_deployment_details
Procedures (for reports / maintenance):
  EXEC sp_get_dashboard_stats;
  EXEC sp_get_upcoming_renewals @days = 30, @include_expired = 1;
  EXEC sp_search @term = N'acme';
  EXEC sp_get_client_summary @client_id = '<client guid>';
  EXEC sp_get_server_usage;
  EXEC sp_purge_old_audit_logs @keep_days = 365;


BACKUPS
-------
Back up the SQL database regularly (SSMS: right-click database -> Tasks -> Back Up)
and keep a copy of settings.env in a separate safe place.


TROUBLESHOOTING
---------------
* Look at logs\server.log first.
* "Set DATABASE_URL in settings.env first"  -> step 2.
* Other PCs can't connect  -> install-service.cmd opens the firewall for
  Private/Domain networks; check the network is not "Public".
* Login works on the server but not from other PCs  -> leave COOKIE_SECURE empty
  unless the site is served over HTTPS.
* Named instance (Server=PC\SQLEXPRESS) won't connect  -> start the
  "SQL Server Browser" service, or use Server=PC,PORT.
