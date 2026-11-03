CLIENT MANAGEMENT PORTAL - API  (IIS site 1 of 2)
==================================================

Compiled API server (no source code). It talks to SQL Server, checks logins and
encrypts the vault. Node.js is included (runtime\); IIS starts it via web.config.

WHAT'S HERE
  web.config     tells IIS how to run it (don't edit)
  settings.env   the only file you edit (database connection)
  bin\           compiled program (don't edit)
  runtime\       Node.js (don't edit)
  logs\          startup errors appear here (stdout_*.log)

ONE-TIME SERVER REQUIREMENT
  The ASP.NET Core Module V2 for IIS. It comes with the free ".NET Hosting Bundle"
  from Microsoft (any version 6, 7, 8 or newer):
     https://dotnet.microsoft.com/download/dotnet  ->  "Hosting Bundle"
  Already installed if the server runs any ASP.NET Core website.
  After installing it, run  iisreset  once.

INSTALL IN IIS
  1. Copy this "api" folder to the server, e.g. C:\inetpub\ClientPortal\api
  2. Edit settings.env -> DATABASE_URL (SQL Server, login, password).
  3. IIS Manager -> Application Pools -> Add:
        Name: ClientPortal-API    .NET CLR version: No Managed Code
  4. IIS Manager -> Sites -> Add Website:
        Site name: ClientPortal-API
        Application pool: ClientPortal-API
        Physical path: C:\inetpub\ClientPortal\api
        Binding: http, IP address 127.0.0.1, any free port YOU choose (example: 4000)
          (127.0.0.1 = only this server can call the API; the application site
           forwards browser requests to it. If the application site is on ANOTHER
           server, use "All Unassigned" instead and allow your port in the firewall
           for that server only.)
        Remember this port: application\settings.env -> API_URL must use it.
  5. Give the app pool write access to the logs folder (PowerShell as admin):
        icacls "C:\inetpub\ClientPortal\api\logs" /grant "IIS AppPool\ClientPortal-API:(OI)(CI)M"

CHECK
  Open http://127.0.0.1:<your API port>/api/auth/me on the server.
  {"success":false,"error":"Authentication required"}  = working.
  HTTP 500.30 / 502.5 = startup problem -> read logs\stdout_*.log

CHANGING SETTINGS
  Edit settings.env, then IIS Manager -> ClientPortal-API -> Restart.

UPDATING TO A NEW VERSION
  Stop the site, replace bin\ and runtime\ (keep settings.env and web.config), start it.
