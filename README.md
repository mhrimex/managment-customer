# Reflection Solutions - Customer Management

A production-ready **Customer Management System** built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, **TanStack Table (v8)**, and **PostgreSQL**. Designed specifically for software development and support agencies to manage client accounts, deployed software solutions (ERP, POS, Mobile Apps, Custom Web, E-Commerce), hosting infrastructure, license renewals, domains, and encrypted credentials.

---

## 🚀 System Architecture & Capabilities

### 1. Authentication & Role-Based Access Control (RBAC)
- **Edge Route Protection** ([`middleware.ts`](file:///c:/Users/Developer8/Desktop/customer%20managment/middleware.ts)): Unauthenticated visitors are automatically redirected to `/login`.
- **Pre-configured Staff Accounts**:
  - **Administrator**: `admin@agency.com` / `Admin123!` (Full permissions, manages clients, deployments, servers, staff accounts, and audits).
  - **Support Engineer**: `support@agency.com` / `Support123!` (Can inspect deployments, view servers, and access credentials with audit logging).
- **Session Tokens**: Signed HMAC-SHA256 tokens stored in secure, `httpOnly` cookies with PBKDF2 password verification.
- **Login Portal** ([`app/login/page.tsx`](file:///c:/Users/Developer8/Desktop/customer%20managment/app/login/page.tsx)): Sleek dark agency aesthetic with one-click demo role switches.
- **Staff User Management (`/users`)** ([`app/users/page.tsx`](file:///c:/Users/Developer8/Desktop/customer%20managment/app/users/page.tsx)):
  - Dedicated admin console to view, provision, edit, and delete staff accounts.
  - Role management (`ADMIN` vs `SUPPORT_ENGINEER`) and password reset modal with PBKDF2 salt & hash.
  - Protection safeguards: prevents self-deletion and prevents demoting/deleting the last administrator.
  - Full audit trail integration (`CREATE_USER`, `UPDATE_USER`, `DELETE_USER`).

### 2. Security Audit Trail & Credential Access Tracking (`/audit-logs`)
- **Tamper-Evident Security Log**:
  - Tracks user logins, logouts, deployment creations, client updates, and notification dispatches.
  - **Credential Access Auditing**: Automatically logs an event whenever any staff member clicks "Reveal" or "Copy" on a sensitive password, SSH key, or API token in a client's credentials vault.
- **Audit Table** ([`app/audit-logs/page.tsx`](file:///c:/Users/Developer8/Desktop/customer%20managment/app/audit-logs/page.tsx)): Filter by action type (`VIEW_CREDENTIAL`, `LOGIN`, `DISPATCH_ALERTS`, etc.), search by staff email or IP address.

### 3. Automated Notification Dispatcher (Slack & Email)
- **Module** ([`lib/notifications.ts`](file:///c:/Users/Developer8/Desktop/customer%20managment/lib/notifications.ts)):
  - Evaluates all deployments for renewals expiring in **<= 7 days** or already expired.
  - Formats and dispatches a rich Slack Block Kit message to `SLACK_WEBHOOK_URL`.
  - Dispatches email alerts to `NOTIFICATION_EMAIL`.
- **Manual & Automated Triggering**: One-click "Dispatch Alerts" button in the navigation bar alert bell dropdown, or via `POST /api/notifications/dispatch`.

### 4. Global Deployments Grid ([`app/deployments/page.tsx`](file:///c:/Users/Developer8/Desktop/customer%20managment/app/deployments/page.tsx))
- **Powered by TanStack Table (v8)**:
  - `useReactTable`, `flexRender`, dynamic column sorting indicators, page size selector (10, 20, 50 rows), and pagination controls.
- **Multi-Criteria Dynamic Filter Bar**:
  - Global Search across Client Name, Phone, Solution Name, Domain/URL, Server IP, or Database.
  - Filter by Solution Category (ERP, POS, Mobile App, Custom Software, E-Commerce).
  - Filter by Server (AWS, Hetzner, DigitalOcean, On-Premise, or External SaaS).
  - Filter by Status (Active, Maintenance, Suspended, Decommissioned).
  - Filter by Renewal Horizon (Due in 7 days, 30 days, 90 days, or Expired).
  - Filter by Environment (Production, Staging, Test).
- **URL Query Sync**: All filters automatically persist to URL search parameters (`useSearchParams`) for shareable, bookmarkable links.
- **CSV Export**: One-click CSV download of filtered deployment records.

### 5. Client Management Center (`/clients` & `/clients/[id]`)
- Full client directory with search and CRUD options.
- **Direct Action Links**: One-click **WhatsApp** (`https://wa.me/...`) and direct phone call (`tel:...`) links.
- **Encrypted Credentials Vault**: Secrets are encrypted on disk/database using **AES-256-GCM** via [`lib/crypto.ts`](file:///c:/Users/Developer8/Desktop/customer%20managment/lib/crypto.ts) with show/hide eye toggles and copy buttons.

### 6. Infrastructure & Hosting Overview (`/servers`)
- Hostname, cloud provider, IP addresses with copy buttons, server type (`CLOUD_VPS`, `DEDICATED`, `ON_PREMISE`), and list of hosted client deployments.

---

## 🗄️ Microsoft SQL Server Database & Schema (`schema.sql`)

The SQL Server schema definition script ([`schema.sql`](file:///c:/Users/Developer8/Desktop/customer%20managment/schema.sql)) is fully compatible with SQL Server 2016+ / Azure SQL / SSMS:

1. **`users`**: Staff accounts (`name`, `email`, `password_hash`, `role`).
2. **`clients`**: Company name, contact person, email, primary/secondary phones, billing address, SLA notes.
3. **`solutions`**: Software names, categories (`ERP`, `POS`, `MOBILE_APP`, `CUSTOM_SOFTWARE`, `E_COMMERCE`, `OTHER`), descriptions.
4. **`servers`**: Server name, provider (AWS, Hetzner, etc.), IP address, server type, login notes.
5. **`client_deployments`** *(Junction Table)*: Client ↔ Solution ↔ Server with instance domain, environment, database name, installed version, license type, renewal date, and support SLA.
6. **`deployment_credentials_vault`**: AES-256-GCM encrypted key-value pairs (DB passwords, SSH ports, API tokens).
7. **`audit_logs`**: Timestamped security audit records (`user_email`, `action`, `resource_type`, `details`, `ip_address`).

---

## ⚡ Quickstart

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
# SQL Server Connection String (update with your instance & credentials)
DATABASE_URL="Server=localhost;Database=client_management_db;User Id=sa;Password=YourPassword123!;TrustServerCertificate=true;Encrypt=false"
```

### 3. Initialize SQL Server Database
You can either:
- Open [`schema.sql`](file:///c:/Users/Developer8/Desktop/customer%20managment/schema.sql) in **SSMS (SQL Server Management Studio)**, create database `client_management_db`, and execute the script.
- Or run the automated initialization script:
```bash
npm run db:init
```
*(Note: If no SQL Server database is running or connected, the app seamlessly runs using its in-memory fallback store for development with zero setup friction!)*

### 4. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

- Sign in with:
  - **Admin**: `admin@agency.com` / `Admin123!`
  - **Support Engineer**: `support@agency.com` / `Support123!`
