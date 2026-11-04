"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Server as ServerIcon,
  PlusCircle,
  Copy,
  ExternalLink,
  Layers,
  Building2,
  ShieldCheck,
  Cpu,
  RefreshCw,
  HardDrive,
  Edit3,
  Trash2,
  KeyRound,
} from "lucide-react";
import { useFeedback } from "@/components/Feedback";
import { Server, ServerAccount } from "@/types";
import { useApp } from "@/components/AppLayoutClient";
import CopyButton from "@/components/CopyButton";
import { SkeletonCards } from "@/components/Skeleton";

export default function ServersPage() {
  const { openNewServer, openEditServer, refreshTrigger, triggerRefresh } = useApp();
  const { toast, confirm } = useFeedback();

  const handleDelete = async (server: Server) => {
    const hosted = server.hosted_deployments?.length || 0;
    const ok = await confirm({
      title: `Delete ${server.server_name}?`,
      message: [
        hosted
          ? `${hosted} deployment(s) are hosted on this server. They will be kept, but will show "no server" until you assign another one.`
          : "The server will be removed from the infrastructure list.",
        (() => {
          const n = accounts.filter((a) => a.server_id.toLowerCase() === server.id.toLowerCase()).length;
          return n ? `Its ${n} employee account(s) on this server will be deleted.` : "";
        })(),
      ].filter(Boolean).join(" "),
      confirmLabel: "Delete server",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/servers/${server.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to delete server");
      toast(`${server.server_name} was deleted.`);
      triggerRefresh();
    } catch (err: any) {
      toast(err.message || "Failed to delete server", "error");
    }
  };
  const [servers, setServers] = useState<Server[]>([]);
  const [accounts, setAccounts] = useState<ServerAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/servers");
      const data = await res.json();
      if (data.success) {
        setServers(data.data);
      }
    } catch (err) {
      console.error("Failed to load servers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
    // employee logins on each server (shown under every server card)
    fetch("/api/server-accounts")
      .then((r) => r.json())
      .then((d) => d.success && setAccounts(d.data))
      .catch(() => {});
  }, [refreshTrigger]);

  const getServerTypeBadge = (type: string) => {
    switch (type) {
      case "CLOUD_VPS":
        return "bg-sky-500/15 text-sky-400 border-sky-500/30";
      case "DEDICATED":
        return "bg-indigo-500/15 text-indigo-400 border-indigo-500/30";
      case "ON_PREMISE":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
      default:
        return "bg-slate-500/15 text-slate-400 border-slate-500/30";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-sky-400 mb-1">
            <Cpu size={14} />
            <span>INFRASTRUCTURE & HARDWARE NODES</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Servers & Hosting Overview
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track cloud VPS instances, dedicated clusters, client on-premise hardware, and hosted tenants
          </p>
        </div>

        <button
          onClick={() => openNewServer()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/25 transition-all self-start sm:self-auto"
        >
          <PlusCircle size={15} />
          <span>Add Infrastructure Node</span>
        </button>
      </div>

      {/* Servers Grid */}
      {loading ? (
        <SkeletonCards count={6} />
      ) : servers.length === 0 ? (
        <div className="py-20 text-center text-xs text-slate-400">
          <ServerIcon size={32} className="mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-medium text-slate-300">No servers registered</p>
          <p className="text-slate-500 mt-1">Register AWS, Hetzner, or local on-premise nodes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {servers.map((server) => (
            <div
              key={server.id}
              className="rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all p-5 glass-panel flex flex-col justify-between space-y-4"
            >
              <div>
                {/* Title & Type */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
                      <ServerIcon size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                        {server.server_name}
                      </h3>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Provider: <span className="text-slate-200 font-medium">{server.provider}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium border ${getServerTypeBadge(
                        server.server_type
                      )}`}
                    >
                      {server.server_type.replace("_", " ")}
                    </span>
                    <button
                      onClick={() => openEditServer(server)}
                      className="w-10 h-10 inline-flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                      title="Edit server"
                      aria-label={`Edit ${server.server_name}`}
                    >
                      <Edit3 size={17} />
                    </button>
                    <button
                      onClick={() => handleDelete(server)}
                      className="w-10 h-10 inline-flex items-center justify-center text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Delete server"
                      aria-label={`Delete ${server.server_name}`}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                {/* Technical specs: IP and Login notes */}
                <div className="mt-4 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Primary IP Address:</span>
                    <div className="flex items-center gap-1.5 font-mono text-slate-200">
                      <span>{server.ip_address}</span>
                      <CopyButton text={server.ip_address} />
                    </div>
                  </div>

                  {server.login_notes && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <span className="text-slate-400 text-[11px] block mb-1">Access Notes:</span>
                      <p className="font-mono text-[11px] text-slate-300 bg-slate-900 p-2 rounded-lg border border-slate-800/60 leading-relaxed whitespace-pre-line">
                        {server.login_notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Hosted Clients Section */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Building2 size={13} className="text-emerald-400" />
                      Hosted Client Deployments ({server.hosted_deployments?.length || 0})
                    </span>
                    <Link
                      href={`/deployments?server_id=${server.id}`}
                      className="text-[11px] text-indigo-400 hover:underline"
                    >
                      Filter Grid
                    </Link>
                  </div>

                  {server.hosted_deployments && server.hosted_deployments.length > 0 ? (
                    <div className="space-y-1.5">
                      {server.hosted_deployments.map((d) => (
                        <div
                          key={d.id}
                          className="p-2 rounded-lg bg-slate-950/40 border border-slate-800/60 flex items-center justify-between text-xs"
                        >
                          <div className="truncate pr-2">
                            <span className="font-medium text-slate-200">
                              {d.client?.company_name || "Client"}
                            </span>
                            <span className="text-slate-500 text-[11px] ml-1.5">
                              ({d.solution?.name})
                            </span>
                          </div>
                          {d.instance_url && (
                            <span className="font-mono text-[11px] text-indigo-300 truncate max-w-[140px]">
                              {d.instance_url}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic py-1">
                      No client instances currently hosted on this server.
                    </div>
                  )}
                </div>

                {/* Employee accounts on this server */}
                {(() => {
                  const here = accounts.filter((a) => a.server_id.toLowerCase() === server.id.toLowerCase());
                  return (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                          <KeyRound size={13} className="text-teal-400" />
                          Employee Accounts ({here.length})
                        </span>
                        <Link href="/employees" className="text-[11px] text-teal-400 hover:underline">
                          Employees
                        </Link>
                      </div>
                      {here.length ? (
                        <div className="space-y-1.5">
                          {here.map((a) => (
                            <Link
                              key={a.id}
                              href={`/employees/${a.employee_id}`}
                              className="p-2 rounded-lg bg-slate-950/40 border border-slate-800/60 hover:border-teal-500/40 flex items-center gap-2 text-xs"
                            >
                              <span className="font-mono font-semibold text-teal-300 truncate">{a.username}</span>
                              <span className="text-slate-400 truncate">{a.employee_name}</span>
                              {!a.is_active && <span className="text-[10px] text-slate-500">(disabled)</span>}
                              <span
                                className="ml-auto shrink-0 flex items-center gap-1 text-slate-400"
                                title={a.deployments.map((d) => `${d.company_name} – ${d.solution_name}`).join(", ") || "No access selected"}
                              >
                                <Building2 size={12} />
                                {a.deployments.length}
                              </span>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 italic py-1">No employee accounts on this server yet.</div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Server Card Footer */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500 font-mono">
                  ID: {server.id.slice(0, 8)}...
                </span>
                <Link
                  href={`/deployments?server_id=${server.id}`}
                  className="font-medium text-sky-400 hover:text-sky-300"
                >
                  View Deployments &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
