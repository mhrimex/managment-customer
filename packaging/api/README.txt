CLIENT MANAGEMENT PORTAL - API  (step 2 of 3)
==============================================

The API is the server part: it talks to SQL Server, checks logins, and encrypts
the vault. Compiled, no source code. Node.js is included (runtime\).
Needs: Windows, network access to SQL Server.

FILES
  settings.env            <- the only file you edit
  setup-database.cmd      creates/upgrades the database (uses ..\database\full-database.sql)
                          setup-database.cmd -Sample adds demo data
  start.cmd               run in a window (quick test; close the window to stop)
  install-service.cmd     run as admin: start with Windows, restart after a crash
  restart-service.cmd     run as admin: restart after editing settings.env
  uninstall-service.cmd   run as admin: stop and remove the automatic start
  bin\, runtime\          compiled program and Node.js (don't edit)
  logs\server.log         created when it runs

INSTALL
  1. Edit settings.env:
       DATABASE_URL   your SQL Server, login and password (see ..\database\README.txt)
       PORT           default 4000
       HOST           127.0.0.1 if the application folder runs on this same machine (default)
                      0.0.0.0   if the application runs on another machine
     Leave AUTH_SECRET / ENCRYPTION_SECRET as they are; they are generated on first start.
  2. Double-click setup-database.cmd (skip if you already ran full-database.sql in SSMS).
  3. Right-click install-service.cmd -> Run as administrator.
  4. BACK UP settings.env (at least ENCRYPTION_SECRET) somewhere safe.
  5. Continue with the application folder (application\README.txt).

CHECK
  http://127.0.0.1:4000/api/auth/me  should answer {"success":false,"error":"Authentication required"}
  (that means the API is running; it only answers API requests, not pages)

UPDATING
  uninstall-service.cmd (admin) -> replace bin\ and runtime\ with the new ones (keep settings.env)
  -> setup-database.cmd -> install-service.cmd (admin)

TROUBLESHOOTING
  Look at logs\server.log first.
  Named instance (Server=PC\SQLEXPRESS) won't connect -> start the "SQL Server Browser"
  service, or use Server=PC,PORT.
  Vault shows "[Decryption Error]" -> ENCRYPTION_SECRET is not the one the secrets were saved with.
