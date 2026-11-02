"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  Layers,
  Server as ServerIcon,
  AlertTriangle,
  Calendar,
  ShieldCheck,
  ArrowUpRight,
  ExternalLink,
  PlusCircle,
  Search,
  Activity,
  CheckCircle2,
  Cpu
} from "lucide-react";
import { DashboardMetrics, ClientDeployment } from "@/types";
import { useApp } from "@/components/AppLayoutClient";
import StatusBadge from "@/components/StatusBadge";
import RenewalBadge from "@/components/RenewalBadge";
import CopyButton from "@/components/CopyButton";
import CompanyAvatar from "@/components/CompanyAvatar";
import { Skeleton, SkeletonRows, SkeletonCards } from "@/components/Skeleton";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const { openSearch, openNewDeployment, openNewClient, refreshTrigger } = useApp();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [deployments, setDeployments] = useState<ClientDeployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/deployments").then((r) => r.json()),
    ])
      .then(([statsRes, depRes]) => {
        if (statsRes.success) setMetrics(statsRes.data);
        if (depRes.success) setDeployments(depRes.data);
      })
      .catch((err) => console.error("Error loading dashboard data:", err))
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  return (
    <div className="space-y-8">
      {/* Page Title & Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-indigo-400 mb-2">
            <Activity size={16} className="animate-pulse" />
            <span>SYSTEM DASHBOARD & ANALYTICS</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Customer Management Overview
          </h1>
          <p className="text-base text-slate-400 mt-2">
            Real-time infrastructure health, client licenses, and upcoming contract renewals
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => openNewClient()}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 transition-all shadow-sm"
          >
            <Building2 size={18} className="text-emerald-400" />
            <span>Register Client</span>
          </button>
          <button
            onClick={() => openNewDeployment()}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-glow transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <PlusCircle size={18} />
            <span>Deploy Solution</span>
          </button>
        </div>
      </div>

      {/* Key Performance Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Metric 1: Total Active Clients */}
        <Link
          href="/clients"
          className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:-translate-y-0.5 hover:shadow-xl hover:border-slate-700 transition-all group glass-panel relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Total Clients
            </span>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Building2 size={24} />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-4xl font-extrabold text-white font-display">
              {metrics ? metrics.total_clients : <Skeleton className="h-10 w-16" />}
            </div>
            <div className="text-sm text-slate-400 mt-1.5 flex items-center gap-1.5">
              <span className="text-emerald-400 font-medium">Managed</span>
              <span>client accounts</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-60" />
        </Link>

        {/* Metric 2: Total Deployed Systems */}
        <Link
          href="/deployments"
          className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:-translate-y-0.5 hover:shadow-xl hover:border-slate-700 transition-all group glass-panel relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Deployed Systems
            </span>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Layers size={24} />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-4xl font-extrabold text-white font-display">
              {metrics ? metrics.total_deployments : <Skeleton className="h-10 w-16" />}
            </div>
            <div className="text-sm text-slate-400 mt-1.5 flex items-center gap-1.5">
              <span className="text-indigo-400 font-medium">Active instances</span>
              <span>across all tiers</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-400 opacity-60" />
        </Link>

        {/* Metric 3: Active Hosting Servers */}
        <Link
          href="/servers"
          className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:-translate-y-0.5 hover:shadow-xl hover:border-slate-700 transition-all group glass-panel relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Active Servers
            </span>
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ServerIcon size={24} />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-4xl font-extrabold text-white font-display">
              {metrics ? metrics.active_servers : <Skeleton className="h-10 w-16" />}
            </div>
            <div className="text-sm text-slate-400 mt-1.5 flex items-center gap-1.5">
              <span className="text-sky-400 font-medium">Cloud & On-Prem</span>
              <span>infrastructure</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-cyan-400 opacity-60" />
        </Link>

        {/* Metric 4: Expiring in 30 Days (Critical Alert) */}
        <Link
          href="/deployments?renewal_due=30"
          className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:-translate-y-0.5 hover:shadow-xl hover:border-amber-500/50 transition-all group glass-panel relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Renewals In 30 Days
            </span>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <AlertTriangle size={24} />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-4xl font-extrabold text-amber-400 font-display">
              {metrics ? metrics.expiring_30_days : <Skeleton className="h-10 w-16" />}
            </div>
            <div className="text-sm text-slate-400 mt-1.5 flex items-center justify-between">
              <span>{metrics?.expired_licenses || 0} already expired</span>
              <span className="text-amber-400 font-medium flex items-center gap-0.5">
                Review <ArrowUpRight size={13} />
              </span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-rose-500 opacity-75" />
        </Link>
      </div>

      {/* Quick Search Interactive Banner */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border-2 border-indigo-500/30 shadow-2xl glass-panel flex flex-col lg:flex-row items-center justify-between gap-6 group hover:border-indigo-500/50 transition-all">
        {/* Glow ambient background */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-4 sm:gap-5 text-center sm:text-left flex-col sm:flex-row">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/20 group-hover:scale-105 transition-transform">
            <Search size={28} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center justify-center sm:justify-start gap-2.5">
              <span>Instant Infrastructure & Client Search</span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-indigo-500/25 text-indigo-300 border border-indigo-500/30">
                FAST
              </span>
            </h2>
            <p className="text-sm sm:text-base text-slate-200 font-medium max-w-2xl leading-relaxed">
              Quickly locate client contact numbers, IP addresses, database schemas, or domain URLs with instant autocomplete.
            </p>
          </div>
        </div>

        <button
          onClick={openSearch}
          className="relative z-10 w-full lg:w-auto px-6 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3.5 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
        >
          <Search size={18} />
          <span>Search Everything</span>
          <kbd className="font-mono text-xs bg-indigo-950/90 text-indigo-200 px-2.5 py-1 rounded-lg border border-indigo-400/40 shadow-inner font-bold">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Two Column Layout: Urgent Renewals & Infrastructure Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Urgent Renewals Alert Table */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/80 border border-slate-800/80 p-6 glass-panel flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                <Calendar size={20} className="text-amber-400" />
                Urgent Renewals & Expiring Licenses (Next 30 Days)
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Client deployments that require invoice generation or license key extension
              </p>
            </div>
            <Link
              href="/deployments?renewal_due=30"
              className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
            >
              View Grid <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="mt-4 overflow-x-auto flex-1">
            {loading && !metrics ? (
              <table className="w-full"><tbody><SkeletonRows rows={4} cols={5} /></tbody></table>
            ) : metrics?.upcoming_renewals && metrics.upcoming_renewals.length > 0 ? (
              <table className="rtable w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-medium">Client & Contact</th>
                    <th className="pb-3 font-medium">Solution</th>
                    <th className="pb-3 font-medium">Domain / Instance</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Renewal Due</th>
                    <th className="pb-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {metrics.upcoming_renewals.map((dep) => (
                    <tr key={dep.id} className="hover:bg-slate-800/30 transition-colors">
                      <td data-primary className="py-3.5">
                        <div className="flex items-center gap-3">
                          <CompanyAvatar name={dep.client?.company_name} logoUrl={dep.client?.logo_url} size="sm" />
                          <div className="min-w-0">
                            <Link
                              href={`/clients/${dep.client_id}`}
                              className="font-semibold text-slate-100 hover:text-indigo-400"
                            >
                              {dep.client?.company_name}
                            </Link>
                            <div className="text-[11px] text-slate-400">
                              {dep.client?.contact_person || dep.client?.phone_primary || "No contact"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Solution" className="py-3">
                        <span className="font-medium text-slate-300">{dep.solution?.name}</span>
                        <div className="text-[11px] text-slate-500 font-mono">{dep.solution?.category}</div>
                      </td>
                      <td data-label="Domain" className="py-3 font-mono">
                        {dep.instance_url ? (
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <span className="truncate max-w-[160px]">{dep.instance_url}</span>
                            <CopyButton text={dep.instance_url} />
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">No domain</span>
                        )}
                      </td>
                      <td data-label="Status" className="py-3">
                        <StatusBadge status={dep.deployment_status} />
                      </td>
                      <td data-label="Renewal" className="py-3">
                        <RenewalBadge date={dep.renewal_date} status={dep.deployment_status} />
                      </td>
                      <td data-label="Action" className="py-3 text-right">
                        <Link
                          href={`/clients/${dep.client_id}`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        >
                          <span>Manage</span>
                          <ArrowUpRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                <CheckCircle2 size={24} className="mx-auto text-emerald-400 mb-2" />
                All client software licenses and support contracts are fully up to date!
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Solutions & Distribution breakdown */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800/80 p-6 glass-panel flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                <Cpu size={20} className="text-indigo-400" />
                Solutions Distribution
              </h2>
              <Link href="/solutions" className="text-xs text-indigo-400 hover:underline">
                Catalog
              </Link>
            </div>

            {/* Category Bars */}
            <div className="mt-4 space-y-3.5">
              {metrics?.by_category && Object.keys(metrics.by_category).length > 0 ? (
                Object.entries(metrics.by_category).map(([category, count]) => {
                  const total = metrics.total_deployments || 1;
                  const pct = Math.round((count / total) * 100);

                  return (
                    <div key={category} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-300 font-medium">{category.replace("_", " ")}</span>
                        <span className="text-slate-400 font-mono">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">No category metrics</div>
              )}
            </div>
          </div>

          {/* Infrastructure Health Card */}
          <div className="mt-6 pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <ShieldCheck size={14} className="text-emerald-400" />
                Support SLA Contracts
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {metrics?.active_support_contracts || 0} Active
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>SQL Server Connection:</span>
              <span className="text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Operational
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Client Deployments Grid */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800/80 p-6 glass-panel">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
              <Layers size={20} className="text-indigo-400" />
              Recent Deployments & Live Instances
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Software instances connected to client environments and server nodes
            </p>
          </div>
          <Link
            href="/deployments"
            className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
          >
            Open Data Table Grid <ArrowUpRight size={13} />
          </Link>
        </div>

        {loading && deployments.length === 0 && <SkeletonCards count={3} className="mt-5" />}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deployments.slice(0, 6).map((dep) => (
            <div
              key={dep.id}
              className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 hover:-translate-y-0.5 transition-all space-y-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <CompanyAvatar name={dep.client?.company_name} logoUrl={dep.client?.logo_url} size="md" />
                  <div className="min-w-0">
                    <Link
                      href={`/clients/${dep.client_id}`}
                      className="font-bold text-base text-slate-100 hover:text-indigo-400 transition-colors line-clamp-1"
                    >
                      {dep.client?.company_name}
                    </Link>
                    <div className="text-sm text-indigo-300 font-medium mt-0.5">
                      {dep.solution?.name}
                    </div>
                  </div>
                </div>
                <StatusBadge status={dep.deployment_status} />
              </div>

              {/* Host and domain details */}
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">Domain:</span>
                  {dep.instance_url ? (
                    <div className="flex items-center gap-1 text-slate-200 font-mono text-[11px]">
                      <a
                        href={`https://${dep.instance_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline flex items-center gap-1 text-indigo-300"
                      >
                        {dep.instance_url}
                        <ExternalLink size={10} />
                      </a>
                      <CopyButton text={dep.instance_url} />
                    </div>
                  ) : (
                    <span className="text-slate-500 italic">None</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">Server:</span>
                  <span className="text-slate-300 font-mono text-[11px]">
                    {dep.server?.server_name || "Cloud SaaS"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">Database:</span>
                  <span className="text-slate-300 font-mono text-[11px]">
                    {dep.database_name || "Default"}
                  </span>
                </div>
              </div>

              {/* Footer with renewal and manage */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <RenewalBadge date={dep.renewal_date} status={dep.deployment_status} />
                <Link
                  href={`/clients/${dep.client_id}`}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  Details <ArrowUpRight size={12} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
