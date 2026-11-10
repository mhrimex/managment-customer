# Deployment Guide

How to install the Client Management Portal on a Windows PC or server, keep it running, update it, and change its settings.

There are two ways to deploy:

| | IIS package: 3 folders (recommended) | From source (this folder) |
|---|---|---|
| What you copy | `database\`, `api\`, `application\`: compiled, **no source code** | The whole project |
| Needs on the server | IIS + ASP.NET Core Module V2 (.NET Hosting Bundle) + SQL Server. Node.js is included | Node.js + npm + SQL Server |
| Build it with | `npm run package` → `..\deployment` | `scripts\deploy.ps1` (section 3) |
| You edit | `api\settings.env`, `application\settings.env` | `.env` |

## 0. The IIS package

On the development PC:

```
npm run package                     (output: ..\deployment, next to this project)
npm run package -- "D:\out\portal"  (or any other folder)
```

The output has exactly three folders, each with a README.txt giving the IIS steps:

| Folder | What it is | On the server |
|---|---|---|
| `database\` | `full-database.sql` creates **everything**: the database, tables, indexes, triggers, the `vw_deployment_details` and `vw_server_account_access` views, 7 stored procedures and the default users. Also `create-app-login.sql` and optional `sample-data.sql` | Run in SSMS (F5) |
| `api\` | API site: `web.config`, `settings.env` (DATABASE_URL), `bin\`, `runtime\`, `logs\` | IIS site, app pool "No Managed Code", binding `127.0.0.1:4000` |
| `application\` | Website: `web.config`, `settings.env` (API_URL), `bin\`, `runtime\`, `logs\` | IIS site, app pool "No Managed Code", binding port 80/443 |

How it runs:
- Each `web.config` tells IIS to start `runtime\node.exe bin\launch.js` through the **ASP.NET Core Module V2**, which comes with the free .NET Hosting Bundle. IIS starts, restarts and stops it together with the site. There are no services and no scripts to run.
- `launch.js` reads `settings.env` and listens only on the local port IIS gives it. Your IIS bindings (http/https, host name, certificate) decide what the outside world sees.
- Browsers only talk to the **application** site, which forwards `/api/...` to `API_URL`. That's why the API site can be bound to `127.0.0.1`.
- `AUTH_SECRET` and `ENCRYPTION_SECRET` are generated into `api\settings.env` when the package is built. **Back up that file.**
- The app pool identity needs write permission on each `logs\` folder (the `icacls` command is in the READMEs).

Re-running `npm run package` replaces `bin\`, `runtime\` and `web.config`, and never overwrites existing `settings.env` files.

The company name (`NEXT_PUBLIC_COMPANY_NAME`) is compiled in, so changing it means running `npm run package` again. To change the logo, replace `application\bin\public\logo.svg` and restart the site.

How the split works in the code: `BUILD_TARGET=api|web` in `next.config.mjs` and the three modes in `middleware.ts`. The website build is made with `app/api` moved aside, so it contains no API or database code. `npm run dev`, `npm run build` and `npm start` are unchanged: they run the website and API together.

The rest of this guide covers deploying **from source**.

---

## 1. Requirements

| What | Version | Notes |
|---|---|---|
| Windows | 10 / 11 / Server 2016+ | |
| Node.js | 18.18 or newer (LTS recommended) | https://nodejs.org |
| Microsoft SQL Server | 2016+ (Express is fine) | Can be on the same PC or another one |
| SQL Server login | SQL authentication | See step 2 |

In **SQL Server Configuration Manager**, check that TCP/IP is enabled and SQL Server listens on port 1433, or on the port you put in `DATABASE_URL`.

---

## 2. Create a database login (once)

Don't use `sa` for the app. In SQL Server Management Studio (SSMS), open a **New Query** on the server and run:

```sql
-- 1. Create the empty database (the app login below can't create databases itself)
IF DB_ID(N'client_management_db') IS NULL CREATE DATABASE client_management_db;
GO

-- 2. A login just for this app. Choose your own strong password.
CREATE LOGIN app_user WITH PASSWORD = 'Choose-A-Strong-Password-123!', CHECK_POLICY = ON;
GO

USE client_management_db;
GO
CREATE USER app_user FOR LOGIN app_user;
-- db_owner lets the app create/upgrade its own tables on start
ALTER ROLE db_owner ADD MEMBER app_user;
GO
```

Your connection string will then be:

```
DATABASE_URL="Server=localhost;Database=client_management_db;User Id=app_user;Password=Choose-A-Strong-Password-123!;TrustServerCertificate=true;Encrypt=false"
```

---

## 3. First install

1. Copy the project folder to the PC, for example `C:\Apps\customer-management`.
2. Open **PowerShell as administrator** (right-click → *Run as administrator*), then run:

   ```powershell
   cd "C:\Apps\customer-management"
   powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -OpenFirewall
   ```

3. The first run creates `.env` with new random secrets and stops. Open `.env`, set `DATABASE_URL` (step 2), and save.
4. **Back up the `ENCRYPTION_SECRET` value** in a password manager. If you lose it, every saved vault password becomes unreadable.
5. Run the same command again. The script:
   - installs packages
   - creates the database and all tables, indexes, triggers and default users
   - builds the production version
   - registers a Windows startup task named **ClientManagementPortal**, which starts the app with Windows and restarts it within 1 minute if it crashes
   - opens the firewall port, so other PCs on the network can reach the app
   - prints the addresses to open
6. Sign in with `admin@agency.com` / `Admin123!`. The app asks for a new password before anything else (the same happens for `support@agency.com` / `Support123!`).

To also load demo data (5 sample clients, servers and deployments), add `-SampleData`. Don't do this on a real system.

### Running only the database script

| Want to | Run |
|---|---|
| Create or upgrade all tables (safe to repeat) | `npm run db:init` |
| Same, plus demo data | `npm run db:seed-sample` |
| Do it by hand in SSMS | Open `schema.sql` → F5, then optionally `seed-sample-data.sql` → F5 |

`schema.sql` creates everything from nothing: the database, 8 tables, indexes, `updated_at` triggers and the 2 default users. Every statement checks first, so running it again never deletes or duplicates data.

---

## 4. Updating to a new version

Copy the new files over the old ones, **keeping your `.env`**. Then, in PowerShell as administrator:

```powershell
cd "C:\Apps\customer-management"
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
```

The script stops the app, updates packages and the database, rebuilds, and starts the app again. Your data is not touched.

You also need to run it after changing **`NEXT_PUBLIC_*`** settings in `.env`, because those are built into the pages. For any other `.env` change, restarting is enough (see section 6).

---

## 5. Where to change things

### Settings in `.env`

| Setting | What it controls | After changing |
|---|---|---|
| `DATABASE_URL` | Which SQL Server, database, login and password the app uses | Restart |
| `PORT` | Web port (default `3000`). With `-OpenFirewall`, re-run `deploy.ps1` so the firewall follows | Restart |
| `AUTH_SECRET` | Signs login sessions. Changing it logs everyone out | Restart |
| `ENCRYPTION_SECRET` | Key for vault passwords. **Never change it** once secrets are stored | — |
| `COOKIE_SECURE` | Leave unset (automatic). Set `true` only if the site is always on HTTPS | Restart |
| `NEXT_PUBLIC_COMPANY_NAME` | Company name in the sidebar and login page | Re-run `deploy.ps1` |
| `NEXT_PUBLIC_COMPANY_LOGO` | Logo path; put the file in `public\` (e.g. `/my-logo.png`) | Re-run `deploy.ps1` |
| `NEXT_PUBLIC_SHOW_DEMO_LOGINS` | One-click demo login buttons. Keep off in real use | Re-run `deploy.ps1` |
| `NODE_ENV` | **Don't set it.** npm sets it automatically | — |

### Settings inside the app

| What | Where |
|---|---|
| Staff accounts, roles and passwords | **Users** page (admin only) |
| Font size, main colour and font for the whole site | **Settings** page (admin only) |
| What each role can do | Admin: everything. Support engineer: view, add and edit, including reading saved passwords (recorded in the Audit Trail), but no deleting, backup, restore, reset or site settings |
| Which build is running | Bottom of the side menu, and **Settings** (warns if the website and API differ) |
| Solutions catalog | **Solutions** page |
| Backup / restore / reset data | **Maintenance** page |

### Install on a phone or iPad

The site can be added to the home screen and then opens full screen, like an app.

| Device | How |
|---|---|
| iPhone / iPad | Open the site in **Safari** → Share button → **Add to Home Screen** |
| Android | Open the site in **Chrome** → ⋮ menu → **Install app** (or **Add to Home screen**) |

Android only offers a real **Install app** when the site is opened over **https://**. Over plain http it adds a shortcut that opens in the browser. iPhone and iPad work over both. Nothing is stored on the device: the app still needs a connection to the server, and shows "You're offline" without one. Files: `app/manifest.ts`, `public/sw.js`, `public/icons/`, `app/apple-icon.png`.

### Files, if you need to change code

| File | Purpose |
|---|---|
| `schema.sql` | Full database structure and default users |
| `seed-sample-data.sql` | Optional demo data |
| `lib/db.ts` | All database queries; automatic upgrades run on start (`runMigrations`) |
| `public/logo.svg`, `app/icon.svg` | Default logo and browser tab icon |
| `tailwind.config.ts`, `app/globals.css` | Colours, fonts, sizes |
| `scripts/deploy.ps1` | Install/update script |
| `scripts/run-server.ps1` | What the startup task runs: waits for SQL Server, then starts the app |

---

## 6. Day-to-day

| Task | How (PowerShell as administrator) |
|---|---|
| Restart the app | `Stop-ScheduledTask ClientManagementPortal; Start-ScheduledTask ClientManagementPortal` |
| Is it running? | `Get-ScheduledTask ClientManagementPortal` → State `Running` |
| See errors | Open `logs\server.log` in the project folder |
| Stop autostart and remove the task | `powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -Uninstall` (database and files are kept) |

If `Stop-ScheduledTask` leaves the app running, the app is a separate `node.exe` process. Running `deploy.ps1` handles this for you.

---

## 7. Backups

You need **both** of these to restore:

1. **The database.** Schedule a nightly backup, either through a SQL Server Agent job or with Windows Task Scheduler running:
   ```
   sqlcmd -S localhost -U app_user -P "<password>" -Q "BACKUP DATABASE client_management_db TO DISK='D:\Backups\client_management_db.bak' WITH INIT, COMPRESSION"
   ```
   (Remove `COMPRESSION` on SQL Server Express. The login needs backup rights: `db_owner` or `db_backupoperator`.)
2. **The `.env` file**, or at least `ENCRYPTION_SECRET`. Store it away from the database backup, for example in a password manager.

The **Maintenance → Export backup** button in the app gives you a JSON snapshot as an extra copy.

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Other PCs can't open the page | Firewall: re-run `deploy.ps1 -OpenFirewall` as admin. Use the address the script printed (`http://192.168.x.x:3000`) |
| Login works on this PC but loops back to the login page from other PCs | `COOKIE_SECURE=true` is set while using `http://`. Remove it |
| "Database setup failed" | Check `DATABASE_URL`, that the SQL Server service runs, that TCP/IP is enabled, and the login/password |
| Named instance (`Server=PC\SQLEXPRESS`) won't connect | Start the **SQL Server Browser** service, or use `Server=PC,PORT` |
| Vault shows "[Decryption Error]" | `ENCRYPTION_SECRET` differs from the one used to save those secrets. Restore the original value |
| Changes to `NEXT_PUBLIC_*` don't show | Re-run `deploy.ps1` (rebuild needed) |
| App doesn't start after reboot | Look at `logs\server.log`. The app waits up to 5 minutes for SQL Server before starting |
| A solution is missing from an employee's access list | The list only shows deployments on the account's server. Open "Not on this server" in the form, then set that deployment's **Hosting Server** |
| The access form lists only company names, with no solutions | The server still runs an old build (the label reads "Companies this account can open"). Replace `bin` in both IIS sites |
| "Could not load the deployments" in the access form | The `api` and `application` sites run different versions. Replace `bin` in both |
| "Can't delete ..." | The item is still in use. The message lists each place: remove those first, then delete it. A deployment must also have the status DECOMMISSIONED |
| Sent to "Change password" after signing in | That login still uses a default password. Choose a new one (8+ characters, a letter and a number) |
| "... already exists" when saving | A client, solution or server with that name, or the same deployment (company, solution, server, database, environment), already exists |
| "Can't change the client, solution or server ..." | Employees have access to that deployment. Untick it on each employee's page first |
