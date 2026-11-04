"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  PaginationState,
} from "@tanstack/react-table";
import {
  Search,
  Download,
  RefreshCw,
  SlidersHorizontal,
  PlusCircle,
  ExternalLink,
  Layers,
  Trash2,
  Edit3,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import {
  ClientDeployment,
  Solution,
  Server,
  DeploymentFilterParams
} from "@/types";
import { useApp } from "@/components/AppLayoutClient";
import { useFeedback } from "@/components/Feedback";
import { Skeleton, SkeletonRows } from "@/components/Skeleton";
import StatusBadge, { EnvironmentBadge } from "@/components/StatusBadge";
import RenewalBadge from "@/components/RenewalBadge";
import CopyButton from "@/components/CopyButton";
import CompanyAvatar from "@/components/CompanyAvatar";
import { formatDate } from "@/lib/utils";

function DeploymentsTableContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openNewDeployment, openEditDeployment, refreshTrigger, triggerRefresh } = useApp();
  const { toast, confirm } = useFeedback();

  // Load filter params from URL search parameters
  const initialSearch = searchParams.get("search") || "";
  const initialCategory = searchParams.get("category") || "all";
  const initialServerId = searchParams.get("server_id") || "all";
  const initialStatus = searchParams.get("status") || "all";
  const initialRenewalDue = searchParams.get("renewal_due") || "all";
  const initialEnvironment = searchParams.get("environment") || "all";

  // Phones: filter dropdowns are folded behind a "Filters" button
  const [showFilters, setShowFilters] = useState(false);

  // Filter State
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [serverId, setServerId] = useState(initialServerId);
  const [status, setStatus] = useState(initialStatus);
  const [renewalDue, setRenewalDue] = useState(initialRenewalDue);
  const [environment, setEnvironment] = useState(initialEnvironment);

  // TanStack Table State
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true }
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // Data & Options
  const [deployments, setDeployments] = useState<ClientDeployment[]>([]);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  // Keep URL in sync with filters
  const updateUrlParams = (newParams: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, val]) => {
      if (val && val !== "all") {
        params.set(key, val);
      } else {
        params.delete(key);
      }
    });
    router.replace(`/deployments?${params.toString()}`, { scroll: false });
  };

  // Fetch servers & solutions dropdown options
  useEffect(() => {
    Promise.all([
      fetch("/api/solutions").then((r) => r.json()),
      fetch("/api/servers").then((r) => r.json()),
    ]).then(([solRes, servRes]) => {
      if (solRes.success) setSolutions(solRes.data);
      if (servRes.success) setServers(servRes.data);
    });
  }, []);

  // Fetch filtered deployments
  const fetchDeployments = async () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    if (category !== "all") query.set("category", category);
    if (serverId !== "all") query.set("server_id", serverId);
    if (status !== "all") query.set("status", status);
    if (renewalDue !== "all") query.set("renewal_due", renewalDue);
    if (environment !== "all") query.set("environment", environment);

    try {
      const res = await fetch(`/api/deployments?${query.toString()}`);
      const data = await res.json();
      if (data.success) {
        setDeployments(data.data);
      }
    } catch (err) {
      console.error("Failed to load deployments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeployments();
  }, [category, serverId, status, renewalDue, environment, refreshTrigger]);

  // Handle Search Input Debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      updateUrlParams({ search });
      fetchDeployments();
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearch("");
    setCategory("all");
    setServerId("all");
    setStatus("all");
    setRenewalDue("all");
    setEnvironment("all");
    router.replace("/deployments", { scroll: false });
  };

  // CSV Export action
  const handleExportCsv = () => {
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    if (category !== "all") query.set("category", category);
    if (serverId !== "all") query.set("server_id", serverId);
    if (status !== "all") query.set("status", status);
    if (renewalDue !== "all") query.set("renewal_due", renewalDue);
    if (environment !== "all") query.set("environment", environment);
    query.set("export", "csv");

    window.open(`/api/deployments?${query.toString()}`, "_blank");
  };

  // Delete Deployment
  const handleDelete = async (id: string, clientName?: string) => {
    const ok = await confirm({
      title: "Delete this deployment?",
      message: `The deployment for ${clientName || "the client"} and its vault credentials will be removed permanently. Employees lose their access to it; their accounts stay.`,
      confirmLabel: "Delete deployment",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/deployments/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast("Deployment deleted.");
        triggerRefresh();
        fetchDeployments();
      } else {
        toast(data.error || "Failed to delete", "error");
      }
    } catch {
      toast("Error deleting deployment", "error");
    }
  };

  // =====================================================================
  // TanStack Table (v8) Columns Definition
  // =====================================================================
  const columns = useMemo<ColumnDef<ClientDeployment>[]>(
    () => [
      {
        id: "client",
        accessorFn: (row) => row.client?.company_name || "",
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1.5 hover:text-white"
          >
            <span>Client & Contact</span>
            {column.getIsSorted() === "asc" ? (
              <ArrowUp size={12} className="text-indigo-400" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown size={12} className="text-indigo-400" />
            ) : (
              <ArrowUpDown size={12} className="opacity-50" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const dep = row.original;
          return (
            <div className="flex items-center gap-3">
              <CompanyAvatar name={dep.client?.company_name} logoUrl={dep.client?.logo_url} size="sm" />
              <div className="min-w-0">
                <Link
                  href={`/clients/${dep.client_id}`}
                  className="font-bold text-slate-100 hover:text-indigo-400 transition-colors block text-sm"
                >
                  {dep.client?.company_name}
                </Link>
                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>{dep.client?.contact_person || "Contact unassigned"}</span>
                  {dep.client?.phone_primary && (
                    <span className="font-mono text-slate-500">
                      {dep.client.phone_primary}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: "solution",
        accessorFn: (row) => row.solution?.name || "",
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1.5 hover:text-white"
          >
            <span>Solution & Category</span>
            {column.getIsSorted() === "asc" ? (
              <ArrowUp size={12} className="text-indigo-400" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown size={12} className="text-indigo-400" />
            ) : (
              <ArrowUpDown size={12} className="opacity-50" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const dep = row.original;
          return (
            <div>
              <div className="font-medium text-slate-200">
                {dep.solution?.name}
              </div>
              <div className="text-[11px] text-indigo-400 font-mono">
                {dep.solution?.category} • {dep.version_installed || "v1.0.0"}
              </div>
            </div>
          );
        },
      },
      {
        id: "server",
        accessorFn: (row) => row.server?.server_name || "",
        header: "Hosting Server & IP",
        cell: ({ row }) => {
          const dep = row.original;
          if (!dep.server) {
            return <span className="text-slate-500 italic">External SaaS / Cloud</span>;
          }
          return (
            <div>
              <div className="text-slate-200 font-medium">
                {dep.server.server_name}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-[11px] text-slate-400">
                  {dep.server.ip_address}
                </span>
                <CopyButton text={dep.server.ip_address} />
                <span className="text-[10px] text-slate-500">
                  ({dep.server.provider})
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: "domain",
        accessorFn: (row) => row.instance_url || "",
        header: "Domain / Instance URL",
        cell: ({ row }) => {
          const dep = row.original;
          if (!dep.instance_url) {
            return <span className="text-slate-500 italic">No domain</span>;
          }
          return (
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <a
                href={`https://${dep.instance_url}`}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-300 hover:underline flex items-center gap-1"
              >
                <span>{dep.instance_url}</span>
                <ExternalLink size={11} />
              </a>
              <CopyButton text={dep.instance_url} />
            </div>
          );
        },
      },
      {
        id: "environment",
        accessorFn: (row) => row.environment,
        header: "Env & Database",
        cell: ({ row }) => {
          const dep = row.original;
          return (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <EnvironmentBadge env={dep.environment} />
              </div>
              {dep.database_name ? (
                <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                  <span>{dep.database_name}</span>
                  <CopyButton text={dep.database_name} />
                </div>
              ) : (
                <span className="text-slate-500 text-[11px]">N/A</span>
              )}
            </div>
          );
        },
      },
      {
        id: "status",
        accessorFn: (row) => row.deployment_status,
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1.5 hover:text-white"
          >
            <span>Status</span>
            {column.getIsSorted() === "asc" ? (
              <ArrowUp size={12} className="text-indigo-400" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown size={12} className="text-indigo-400" />
            ) : (
              <ArrowUpDown size={12} className="opacity-50" />
            )}
          </button>
        ),
        cell: ({ row }) => <StatusBadge status={row.original.deployment_status} />,
      },
      {
        id: "renewal",
        accessorFn: (row) => row.renewal_date || "",
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1.5 hover:text-white"
          >
            <span>Renewal & Support</span>
            {column.getIsSorted() === "asc" ? (
              <ArrowUp size={12} className="text-indigo-400" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown size={12} className="text-indigo-400" />
            ) : (
              <ArrowUpDown size={12} className="opacity-50" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const dep = row.original;
          return (
            <div>
              <RenewalBadge date={dep.renewal_date} status={dep.deployment_status} />
              <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                <span>Contract:</span>
                <span className="font-medium text-slate-300">
                  {dep.support_contract_status}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const dep = row.original;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <button
                onClick={() => openEditDeployment(dep)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Edit Deployment Specs"
                aria-label="Edit deployment"
              >
                <Edit3 size={18} />
              </button>
              <button
                onClick={() => handleDelete(dep.id, dep.client?.company_name)}
                className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                title="Delete Deployment"
                aria-label="Delete deployment"
              >
                <Trash2 size={18} />
              </button>
            </div>
          );
        },
      },
    ],
    []
  );

  // Initialize TanStack Table instance
  const table = useReactTable({
    data: deployments,
    columns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const hasActiveFilters =
    search ||
    category !== "all" ||
    serverId !== "all" ||
    status !== "all" ||
    renewalDue !== "all" ||
    environment !== "all";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 mb-1">
            <Layers size={14} />
            <span>GLOBAL DEPLOYMENTS DATA GRID (TANSTACK TABLE v8)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Client Deployments & Instances
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Search, filter, inspect servers, renewal timelines and connection specs
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all shadow-sm"
            title="Export filtered records to CSV"
          >
            <Download size={14} className="text-indigo-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => openNewDeployment()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all"
          >
            <PlusCircle size={15} />
            <span>New Deployment</span>
          </button>
        </div>
      </div>

      {/* Dynamic Multi-Criteria Filter Bar */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 glass-panel space-y-4">
        {/* Row 1: Global Search & Reset */}
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client, phone, domain, IP, database..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`sm:hidden flex-1 px-3 py-2.5 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                showFilters || hasActiveFilters
                  ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/40"
                  : "bg-slate-800 text-slate-300 border-slate-700/80"
              }`}
              aria-expanded={showFilters}
            >
              <SlidersHorizontal size={15} />
              <span>{showFilters ? "Hide filters" : hasActiveFilters ? "Filters (on)" : "Filters"}</span>
            </button>
            <button
              onClick={() => fetchDeployments()}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/80 flex items-center gap-1.5 transition-colors"
              title="Refresh Grid"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <X size={13} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Select Filters */}
        <div className={`${showFilters ? "grid" : "hidden"} sm:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-800/80`}>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Solution Type
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                updateUrlParams({ category: e.target.value });
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All Solutions</option>
              <option value="ERP">ERP Suite</option>
              <option value="POS">Retail POS</option>
              <option value="MOBILE_APP">Mobile Apps</option>
              <option value="CUSTOM_SOFTWARE">Custom Software</option>
              <option value="E_COMMERCE">E-Commerce</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Hosting Server
            </label>
            <select
              value={serverId}
              onChange={(e) => {
                setServerId(e.target.value);
                updateUrlParams({ server_id: e.target.value });
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All Servers</option>
              <option value="none">External / Cloud SaaS</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.server_name} ({s.provider})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Deployment Status
            </label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                updateUrlParams({ status: e.target.value });
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DECOMMISSIONED">Decommissioned</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Renewal Horizon
            </label>
            <select
              value={renewalDue}
              onChange={(e) => {
                setRenewalDue(e.target.value);
                updateUrlParams({ renewal_due: e.target.value });
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">Any Renewal Date</option>
              <option value="7">Due in 7 Days (Urgent)</option>
              <option value="30">Due in 30 Days</option>
              <option value="90">Due in 90 Days</option>
              <option value="expired">Expired Licenses</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Environment
            </label>
            <select
              value={environment}
              onChange={(e) => {
                setEnvironment(e.target.value);
                updateUrlParams({ environment: e.target.value });
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All Environments</option>
              <option value="PRODUCTION">Production</option>
              <option value="STAGING">Staging</option>
              <option value="TEST">Test</option>
            </select>
          </div>
        </div>
      </div>

      {/* TanStack Table Grid */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden glass-panel shadow-xl">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">Showing {deployments.length}</span>
            <span>matched client deployments</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 text-slate-300 rounded px-2 py-0.5"
            >
              {[5, 10, 20, 50].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Phone layout: one card per deployment */}
        <div className="md:hidden divide-y divide-slate-800/80">
          {loading && deployments.length === 0 ? (
            <div className="p-5 space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3.5 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : table.getRowModel().rows.length === 0 ? (
            <div className="py-14 px-5 text-center text-slate-400">
              <AlertCircle size={28} className="mx-auto text-slate-500 mb-2" />
              <p className="text-sm font-medium text-slate-300">No deployments found</p>
              <p className="text-xs text-slate-500 mt-1">Try adjusting or resetting your filters above.</p>
            </div>
          ) : (
            table.getRowModel().rows.map((row) => {
              const dep = row.original;
              return (
                <div key={row.id} className="p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <CompanyAvatar name={dep.client?.company_name} logoUrl={dep.client?.logo_url} size="md" />
                      <div className="min-w-0">
                        <Link
                          href={`/clients/${dep.client_id}`}
                          className="font-bold text-base text-slate-100 hover:text-indigo-400 line-clamp-1"
                        >
                          {dep.client?.company_name}
                        </Link>
                        <div className="text-sm text-indigo-300 font-medium truncate">{dep.solution?.name}</div>
                      </div>
                    </div>
                    <StatusBadge status={dep.deployment_status} />
                  </div>

                  <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
                    <dt className="text-slate-500">Domain</dt>
                    <dd className="font-mono text-slate-200 truncate flex items-center gap-1.5 min-w-0">
                      {dep.instance_url ? (
                        <>
                          <span className="truncate">{dep.instance_url}</span>
                          <CopyButton text={dep.instance_url} />
                        </>
                      ) : (
                        <span className="text-slate-500 italic font-sans">None</span>
                      )}
                    </dd>
                    <dt className="text-slate-500">Server</dt>
                    <dd className="text-slate-200 truncate">
                      {dep.server ? `${dep.server.server_name} (${dep.server.ip_address})` : "External SaaS / Cloud"}
                    </dd>
                    <dt className="text-slate-500">Env</dt>
                    <dd><EnvironmentBadge env={dep.environment} /></dd>
                  </dl>

                  <div className="flex items-center justify-between pt-1">
                    <RenewalBadge date={dep.renewal_date} status={dep.deployment_status} />
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditDeployment(dep)}
                        className="p-2.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                        aria-label="Edit deployment"
                      >
                        <Edit3 size={19} />
                      </button>
                      <button
                        onClick={() => handleDelete(dep.id, dep.client?.company_name)}
                        className="p-2.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
                        aria-label="Delete deployment"
                      >
                        <Trash2 size={19} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="bg-slate-950/70 border-b border-slate-800 text-slate-400 select-none">
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="py-3.5 px-4 font-semibold">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody className="divide-y divide-slate-800/60">
              {loading && deployments.length === 0 ? (
                <SkeletonRows rows={6} cols={columns.length} />
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-16 text-center text-slate-400">
                    <AlertCircle size={28} className="mx-auto text-slate-500 mb-2" />
                    <p className="text-sm font-medium text-slate-300">No deployments found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Try adjusting or resetting your multi-criteria filters above.
                    </p>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="py-3.5 px-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* TanStack Pagination Controls */}
        <div className="px-5 py-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-400">
          <div>
            Page <span className="font-semibold text-white">{table.getState().pagination.pageIndex + 1}</span> of{" "}
            <span className="font-semibold text-white">{Math.max(1, table.getPageCount())}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="p-2.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:hover:bg-transparent"
              title="First Page"
            >
              <ChevronsLeft size={18} />
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-2.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:hover:bg-transparent"
              title="Previous Page"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-2.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:hover:bg-transparent"
              title="Next Page"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="p-2.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:hover:bg-transparent"
              title="Last Page"
            >
              <ChevronsRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DeploymentsPage() {
  return (
    <Suspense fallback={<div className="text-xs text-slate-400 py-10 text-center">Loading deployment filters...</div>}>
      <DeploymentsTableContent />
    </Suspense>
  );
}
