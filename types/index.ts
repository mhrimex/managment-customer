// =====================================================================
// Client & Solutions Management System - TypeScript Type Definitions
// =====================================================================

export type SolutionCategory =
  | 'ERP'
  | 'POS'
  | 'MOBILE_APP'
  | 'CUSTOM_SOFTWARE'
  | 'E_COMMERCE'
  | 'OTHER';

export type ServerType =
  | 'CLOUD_VPS'
  | 'DEDICATED'
  | 'SHARED'
  | 'ON_PREMISE';

export type DeploymentStatus =
  | 'ACTIVE'
  | 'MAINTENANCE'
  | 'SUSPENDED'
  | 'DECOMMISSIONED';

export type DeploymentEnvironment =
  | 'PRODUCTION'
  | 'STAGING'
  | 'TEST';

export type LicenseType =
  | 'MONTHLY_SUBSCRIPTION'
  | 'ANNUAL_LICENSE'
  | 'ONE_TIME_PERPETUAL';

export type SupportContractStatus =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'NO_CONTRACT';

export interface Client {
  id: string;
  company_name: string;
  contact_person?: string | null;
  email?: string | null;
  phone_primary?: string | null;
  phone_secondary?: string | null;
  address?: string | null;
  notes?: string | null;
  /** Company logo as a small data:image URL (PNG/JPEG/WebP), or null for initials avatar */
  logo_url?: string | null;
  created_at?: string;
  updated_at?: string;
  deployments?: ClientDeployment[];
  deployments_count?: number;
}

export interface Solution {
  id: string;
  name: string;
  category: SolutionCategory;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  deployments_count?: number;
}

export interface Server {
  id: string;
  server_name: string;
  provider: string;
  ip_address: string;
  server_type: ServerType;
  login_notes?: string | null;
  created_at?: string;
  updated_at?: string;
  deployments_count?: number;
  hosted_deployments?: ClientDeployment[];
}

export interface DeploymentCredential {
  id: string;
  deployment_id: string;
  key_label: string;
  key_value: string;
  created_at?: string;
  updated_at?: string;
}

export interface ClientDeployment {
  id: string;
  client_id: string;
  solution_id: string;
  server_id?: string | null;
  instance_url?: string | null;
  deployment_status: DeploymentStatus;
  environment: DeploymentEnvironment;
  database_name?: string | null;
  version_installed?: string | null;
  license_type: LicenseType;
  renewal_date?: string | null;
  support_contract_status: SupportContractStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;

  // Joined relations for presentation in TanStack data grid and detail views
  client?: Client;
  solution?: Solution;
  server?: Server | null;
  credentials?: DeploymentCredential[];
}

export interface DeploymentFilterParams {
  search?: string;
  solution_id?: string;
  category?: SolutionCategory | string;
  server_id?: string;
  server_type?: ServerType | string;
  status?: DeploymentStatus | string;
  environment?: DeploymentEnvironment | string;
  renewal_due?: '7' | '30' | '90' | 'expired' | 'all';
  support_status?: SupportContractStatus | string;
  page?: number;
  limit?: number;
  sort_by?: keyof ClientDeployment | string;
  sort_order?: 'asc' | 'desc';
}

export interface DashboardMetrics {
  total_clients: number;
  total_deployments: number;
  active_servers: number;
  expiring_30_days: number;
  expired_licenses: number;
  active_support_contracts: number;
  by_category: Record<string, number>;
  by_status: Record<string, number>;
  upcoming_renewals: ClientDeployment[];
}

export interface AutocompleteSearchResult {
  clients: Array<{ id: string; title: string; subtitle: string; type: 'client' }>;
  deployments: Array<{ id: string; title: string; subtitle: string; clientId: string; type: 'deployment' }>;
  servers: Array<{ id: string; title: string; subtitle: string; type: 'server' }>;
  solutions: Array<{ id: string; title: string; subtitle: string; type: 'solution' }>;
  /** employees matched by name or by one of their server usernames */
  employees?: Array<{ id: string; title: string; subtitle: string; type: 'employee' }>;
}

export type UserRole = 'ADMIN' | 'SUPPORT_ENGINEER';

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash?: string;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  user_email: string;
  action: 'LOGIN' | 'LOGOUT' | 'VIEW_CREDENTIAL' | 'COPY_CREDENTIAL' | 'CREATE_DEPLOYMENT' | 'UPDATE_DEPLOYMENT' | 'DELETE_DEPLOYMENT' | 'CREATE_CLIENT' | 'UPDATE_CLIENT' | 'DELETE_CLIENT' | 'DISPATCH_ALERTS' | string;
  resource_type: 'CREDENTIAL' | 'CLIENT' | 'DEPLOYMENT' | 'SERVER' | 'SOLUTION' | 'USER' | 'SYSTEM' | 'EMPLOYEE' | 'ACCOUNT';
  resource_id?: string | null;
  details?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export interface NotificationDispatchResult {
  success: boolean;
  timestamp: string;
  alerts_count: number;
  slack_delivered: boolean;
  email_delivered: boolean;
  items: Array<{
    deployment_id: string;
    client_name: string;
    solution_name: string;
    renewal_date: string;
    days_remaining: number;
  }>;
}

export interface SystemBackupData {
  version: string;
  exported_at: string;
  stats: {
    clients_count: number;
    solutions_count: number;
    servers_count: number;
    deployments_count: number;
    credentials_count: number;
    audit_logs_count: number;
  };
  clients: Client[];
  solutions: Solution[];
  servers: Server[];
  deployments: ClientDeployment[];
  credentials: DeploymentCredential[];
  audit_logs?: AuditLog[];
  // since backup version 1.1.0
  employees?: Partial<Employee>[];
  server_accounts?: Array<Record<string, any>>;
  server_account_deployments?: Array<{ account_id: string; deployment_id: string }>;
  /** only in backups from version 1.1.0, when access was per company */
  server_account_access?: Array<{ account_id: string; client_id: string }>;
}

/** A person who logs in to systems hosted on your servers (e.g. Mohamad). */
export interface Employee {
  id: string;
  full_name: string;
  job_title?: string | null;
  email?: string | null;
  phone?: string | null;
  /** company the person works for (optional) */
  client_id?: string | null;
  client_name?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  accounts_count?: number;
  /** filled on lists (compact) and on the detail page (full) */
  accounts?: ServerAccount[];
}

/** A deployment an account can open: company + solution + database on the account's server. */
export interface AccountDeployment {
  id: string;
  client_id: string;
  company_name: string;
  solution_name: string;
  database_name?: string | null;
  environment?: string;
  instance_url?: string | null;
}

/** One line of the access report. Account and deployment fields are null when there are none. */
export interface AccessReportRow {
  employee_id: string;
  employee_name: string;
  job_title: string | null;
  employee_active: boolean;
  account_id: string | null;
  username: string | null;
  account_active: boolean | null;
  server_name: string | null;
  server_ip: string | null;
  deployment_id: string | null;
  client_id: string | null;
  company_name: string | null;
  solution_name: string | null;
  database_name: string | null;
  environment: string | null;
  deployment_status: string | null;
}

/** A deployment an account can't be given access to, because it isn't on the account's server. */
export interface OtherDeployment extends AccountDeployment {
  server_name: string | null;
}

/** One login on one server (e.g. mohamad1 on Rimex) and the deployments it can open there. */
export interface ServerAccount {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_active?: boolean;
  server_id: string;
  server_name?: string;
  server_ip?: string;
  username: string;
  /** the password itself is only returned by the reveal endpoint */
  has_password: boolean;
  is_active: boolean;
  notes?: string | null;
  deployments: AccountDeployment[];
  created_at?: string;
  updated_at?: string;
}

