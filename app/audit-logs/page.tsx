"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Filter,
  Key,
  UserCheck,
  Layers,
  Building2,
  AlertTriangle,
  Clock,
  Eye,
  Copy
} from "lucide-react";
import { AuditLog } from "@/types";
import { formatDate } from "@/lib/utils";
import { SkeletonRows } from "@/components/Skeleton";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (actionFilter !== "all") query.set("action", actionFilter);
      if (search.trim()) query.set("search", search.trim());

      const res = await fetch(`/api/audit?${query.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  useEffect(() => {
    const handler = setTimeout(() => fetchLogs(), 300);
    return () => clearTimeout(handler);
  }, [search]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case "VIEW_CREDENTIAL":
        return {
          icon: Eye,
          className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
        };
      case "COPY_CREDENTIAL":
        return {
          icon: Copy,
          className: "bg-rose-500/15 text-rose-300 border-rose-500/30 animate-pulse",
        };
      case "LOGIN":
        return {
          icon: UserCheck,
          className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        };
      case "DISPATCH_ALERTS":
        return {
          icon: AlertTriangle,
          className: "bg-sky-500/15 text-sky-300 border-sky-500/30",
        };
      case "CREATE_DEPLOYMENT":
      case "UPDATE_DEPLOYMENT":
        return {
          icon: Layers,
          className: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
        };
      default:
        return {
          icon: ShieldCheck,
          className: "bg-slate-500/15 text-slate-300 border-slate-500/30",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400 mb-1">
            <ShieldCheck size={14} />
            <span>SECURITY & COMPLIANCE LOGS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Audit Trail & Credential Access
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Immutable log recording staff logins, vault secret views, deployments and administrative actions
          </p>
        </div>

        <button
          onClick={() => fetchLogs()}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all shadow-sm self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          <span>Refresh Trail</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 glass-panel flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by staff email, action, details or IP..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <div className="w-full sm:w-64">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
          >
            <option value="all">All Audit Actions</option>
            <option value="VIEW_CREDENTIAL">VIEW_CREDENTIAL (Secret Revealed)</option>
            <option value="COPY_CREDENTIAL">COPY_CREDENTIAL (Secret Copied)</option>
            <option value="LOGIN">LOGIN (Staff Sign In)</option>
            <option value="LOGOUT">LOGOUT (Staff Sign Out)</option>
            <option value="DISPATCH_ALERTS">DISPATCH_ALERTS (Renewal Dispatcher)</option>
            <option value="CREATE_DEPLOYMENT">CREATE_DEPLOYMENT</option>
            <option value="DELETE_CLIENT">DELETE_CLIENT</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden glass-panel shadow-xl">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-white">Showing {logs.length} logged security events</span>
          <span className="font-mono text-[11px] text-slate-500">Tamper-evident timestamped trail</span>
        </div>

        <div className="overflow-x-auto">
          <table className="rtable w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 select-none">
                <th className="py-3.5 px-4 font-semibold">Timestamp</th>
                <th className="py-3.5 px-4 font-semibold">Staff Member</th>
                <th className="py-3.5 px-4 font-semibold">Action</th>
                <th className="py-3.5 px-4 font-semibold">Resource</th>
                <th className="py-3.5 px-4 font-semibold">Details</th>
                <th className="py-3.5 px-4 text-right font-semibold">IP Address</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60">
              {loading && logs.length === 0 ? (
                <SkeletonRows rows={8} cols={6} />
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    No matching audit logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const Icon = badge.icon;

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td data-primary className="py-3 px-4 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-slate-500" />
                          <span>{formatDate(log.created_at)}</span>
                          <span className="text-slate-500">
                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      </td>

                      <td data-label="Staff" className="py-3 px-4">
                        <span className="font-semibold text-slate-200 block">{log.user_email}</span>
                      </td>

                      <td data-label="Action" className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${badge.className}`}>
                          <Icon size={11} />
                          <span>{log.action}</span>
                        </span>
                      </td>

                      <td data-label="Resource" className="py-3 px-4 font-mono text-[11px] text-indigo-300">
                        {log.resource_type}
                      </td>

                      <td data-label="Details" className="py-3 px-4 text-slate-300 max-w-md">
                        <span className="line-clamp-2">{log.details || "No details provided"}</span>
                      </td>

                      <td data-label="IP" className="py-3 px-4 text-right font-mono text-[11px] text-slate-500">
                        {log.ip_address || "127.0.0.1"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
