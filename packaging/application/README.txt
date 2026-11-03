CLIENT MANAGEMENT PORTAL - APPLICATION  (step 3 of 3)
=====================================================

The website people open in their browser (PC or phone). Compiled, no source code.
Node.js is included (runtime\). It gets all data from the api; it never touches
the database and holds no passwords or keys.

FILES
  settings.env            <- the only file you edit
  start.cmd               run in a window (quick test; close the window to stop)
  install-service.cmd     run as admin: start with Windows, restart after a crash,
                          and open the port in Windows Firewall
  restart-service.cmd     run as admin: restart after editing settings.env
  uninstall-service.cmd   run as admin: stop and remove the automatic start
  bin\, runtime\          compiled program and Node.js (don't edit)
  logs\server.log         created when it runs

INSTALL
  1. Edit settings.env:
       PORT      default 3000
       API_URL   where the api runs. Same machine: http://127.0.0.1:4000 (default)
                 Other machine: http://<api-machine-ip>:4000 (and HOST=0.0.0.0 in api\settings.env)
  2. Right-click install-service.cmd -> Run as administrator.
  3. Open http://localhost:3000 (other PCs/phones: http://<this-machine-ip>:3000)
     Sign in: admin@agency.com / Admin123!  -> change the password on the Users page.

CHANGING THE LOGO
  Replace bin\public\logo.svg (keep the name), then restart-service.cmd.

UPDATING
  uninstall-service.cmd (admin) -> replace bin\ and runtime\ (keep settings.env)
  -> install-service.cmd (admin)

TROUBLESHOOTING
  Look at logs\server.log first.
  Pages load but show "failed to load" -> the api is not running or API_URL is wrong.
  Other PCs can't open the site -> make sure the network is "Private" (not Public) in
  Windows, or open port 3000 in the firewall.
  Sign-in works on the server but not from other PCs -> leave COOKIE_SECURE empty in
  api\settings.env unless the site is served over HTTPS.
