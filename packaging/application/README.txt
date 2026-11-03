CLIENT MANAGEMENT PORTAL - APPLICATION  (IIS site 2 of 2)
==========================================================

Compiled website (no source code) that people open on PC or phone. It gets all
data from the API site; it holds no database login or keys. Node.js is included
(runtime\); IIS starts it via web.config.

WHAT'S HERE
  web.config     tells IIS how to run it (don't edit)
  settings.env   the only file you edit (where the API site is)
  bin\           compiled program (don't edit)
  runtime\       Node.js (don't edit)
  logs\          startup errors appear here (stdout_*.log)

INSTALL IN IIS  (after the API site, see api\README.txt)
  1. Copy this "application" folder to the server, e.g. C:\inetpub\ClientPortal\application
  2. settings.env -> API_URL: the API site's address. Default http://127.0.0.1:4000
     is right when the API site is on this server with that binding.
  3. IIS Manager -> Application Pools -> Add:
        Name: ClientPortal-Web    .NET CLR version: No Managed Code
  4. IIS Manager -> Sites -> Add Website:
        Site name: ClientPortal-Web
        Application pool: ClientPortal-Web
        Physical path: C:\inetpub\ClientPortal\application
        Binding: http, All Unassigned, port 80 (or any port / host name you like;
                 add an https binding with your certificate if you have one)
  5. Give the app pool write access to the logs folder (PowerShell as admin):
        icacls "C:\inetpub\ClientPortal\application\logs" /grant "IIS AppPool\ClientPortal-Web:(OI)(CI)M"
  6. Open the site: http://<server>/  ->  admin@agency.com / Admin123!
     Change both default passwords on the Users page right away.

IMPORTANT
  It must be its own website (or the root of one), not a sub-folder application
  like http://server/portal - the app expects to be at the root of the address.

CHANGING THE LOGO
  Replace bin\public\logo.svg (same name), then restart the site.

CHANGING SETTINGS
  Edit settings.env, then IIS Manager -> ClientPortal-Web -> Restart.

UPDATING TO A NEW VERSION
  Stop the site, replace bin\ and runtime\ (keep settings.env and web.config), start it.

TROUBLESHOOTING
  HTTP 500.30 / 502.5            -> read logs\stdout_*.log
  Pages load but data fails      -> API site stopped, or API_URL wrong
  HTTP 500.19 (config error)     -> ASP.NET Core Module not installed (see api\README.txt)
