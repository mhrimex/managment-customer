"use client";

import ModalShell, { ModalCloseButton } from "@/components/ModalShell";
import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Layers,
  Server as ServerIcon,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  PlusCircle,
  ArrowLeft,
  MessageSquare,
  Edit3,
  Trash2,
  ShieldCheck,
  Plus,
  FileText,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  KeyRound,
  Contact,
} from "lucide-react";
import { Client, ClientDeployment, DeploymentCredential, ServerAccount } from "@/types";
import { useApp } from "@/components/AppLayoutClient";
import StatusBadge, { EnvironmentBadge } from "@/components/StatusBadge";
import RenewalBadge from "@/components/RenewalBadge";
import CopyButton from "@/components/CopyButton";
import CompanyAvatar from "@/components/CompanyAvatar";
import { useFeedback } from "@/components/Feedback";
import { useSafeDelete } from "@/components/useSafeDelete";
import DeploymentAccessModal from "@/components/DeploymentAccessModal";
import { Skeleton, SkeletonCards } from "@/components/Skeleton";
import { formatDate } from "@/lib/utils";

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { openEditClient, openNewDeployment, openEditDeployment, refreshTrigger, triggerRefresh } = useApp();
  const { toast, confirm } = useFeedback();
  const safeDelete = useSafeDelete();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  // Credential Modal State
  const [isAddCredOpen, setIsAddCredOpen] = useState(false);
  const [selectedDeploymentId, setSelectedDeploymentId] = useState("");
  const [credKey, setCredKey] = useState("");
  const [credValue, setCredValue] = useState("");
  const [credLoading, setCredLoading] = useState(false);

  const fetchClient = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${id}`);
      const data = await res.json();
      if (data.success) {
        setClient(data.data);
      } else {
        setClient(null);
      }
    } catch (err) {
      console.error("Error loading client:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClient();
  }, [id, refreshTrigger]);

  const [accessFor, setAccessFor] = useState<{ id: string; title: string; serverId: string; serverName: string } | null>(null);

  // Employee logins that can open this company (on any server)
  const [access, setAccess] = useState<ServerAccount[]>([]);
  useEffect(() => {
    fetch(`/api/server-accounts?client_id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => d.success && setAccess(d.data))
      .catch(() => {});
  }, [id, refreshTrigger]);

  // Secret values are never in the client payload; fetch one on demand (server logs the read).
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});
  const [copiedCred, setCopiedCred] = useState<string | null>(null);

  const fetchSecret = async (credId: string, purpose: "reveal" | "copy"): Promise<string | null> => {
    try {
      const res = await fetch(`/api/credentials?id=${encodeURIComponent(credId)}&purpose=${purpose}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Could not read credential");
      return data.data.key_value as string;
    } catch (err: any) {
      toast(err.message || "Could not read credential", "error");
      return null;
    }
  };

  const toggleShowSecret = async (credId: string) => {
    if (showSecret[credId]) {
      setShowSecret((prev) => ({ ...prev, [credId]: false }));
      setSecretValues((prev) => {
        const { [credId]: _removed, ...rest } = prev;
        return rest;
      });
      return;
    }
    const value = await fetchSecret(credId, "reveal");
    if (value === null) return;
    setSecretValues((prev) => ({ ...prev, [credId]: value }));
    setShowSecret((prev) => ({ ...prev, [credId]: true }));
  };

  const copySecret = async (credId: string) => {
    const value = secretValues[credId] ?? (await fetchSecret(credId, "copy"));
    if (value === null) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedCred(credId);
    setTimeout(() => setCopiedCred((c) => (c === credId ? null : c)), 2000);
  };


  // Delete Deployment
  const handleDeleteDeployment = async (depId: string, solutionName?: string) => {
    const deleted = await safeDelete({
      kind: "deployment",
      id: depId,
      title: `Delete ${solutionName || "this"} deployment?`,
      message: "The deployment will be removed permanently.",
      confirmLabel: "Delete deployment",
    });
    if (!deleted) return;
    toast("Deployment deleted.");
    triggerRefresh();
    fetchClient();
  };

  // Add Credential to Vault
  const handleAddCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeploymentId || !credKey.trim() || !credValue.trim()) return;

    setCredLoading(true);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deployment_id: selectedDeploymentId,
          key_label: credKey.trim(),
          key_value: credValue.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAddCredOpen(false);
        setCredKey("");
        setCredValue("");
        toast("Credential stored in the vault.");
        fetchClient();
      } else {
        toast(data.error || "Failed to add credential", "error");
      }
    } catch {
      toast("Error adding credential", "error");
    } finally {
      setCredLoading(false);
    }
  };

  // Delete Credential
  const handleDeleteCredential = async (credId: string) => {
    const ok = await confirm({
      title: "Remove this credential?",
      message: "The secret will be deleted from the vault permanently.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/credentials?id=${credId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast("Credential removed.");
        fetchClient();
      } else {
        toast(data.error || "Failed to remove credential", "error");
      }
    } catch {
      toast("Error removing credential", "error");
    }
  };

  if (loading && !client) {
    return (
      <div className="space-y-8" role="status" aria-label="Loading client">
        <div className="flex items-center gap-5 pb-6 border-b border-slate-800">
          <Skeleton className="w-20 h-20 rounded-2xl" />
          <div className="space-y-3 flex-1">
            <Skeleton className="h-9 w-72 max-w-full" />
            <Skeleton className="h-5 w-96 max-w-full" />
          </div>
        </div>
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Client Not Found</h2>
        <p className="text-xs text-slate-400">The client record does not exist or may have been deleted.</p>
        <Link
          href="/clients"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs hover:bg-slate-700"
        >
          <ArrowLeft size={17} /> Back to Clients Directory
        </Link>
      </div>
    );
  }

  // Format WhatsApp Link
  const cleanPhone = (phone?: string | null) => {
    if (!phone) return "";
    return phone.replace(/[^0-9]/g, "");
  };

  return (
    <div className="space-y-8">
      {/* Back Button & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <Link
            href="/clients"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={17} /> Back to All Clients
          </Link>
          <div className="flex items-center gap-5">
            <CompanyAvatar name={client.company_name} logoUrl={client.logo_url} size="xl" />
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                  {client.company_name}
                </h1>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Active Client
                </span>
              </div>
              <p className="text-base text-slate-400 mt-1.5">
                Registered on {formatDate(client.created_at)} • {client.deployments?.length || 0} deployed solutions
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => openEditClient(client)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors whitespace-nowrap"
          >
            <Edit3 size={14} />
            <span>Edit Profile</span>
          </button>

          <button
            onClick={() => openNewDeployment(client.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all whitespace-nowrap"
          >
            <PlusCircle size={15} />
            <span>Deploy New Solution</span>
          </button>
        </div>
      </div>

      {/* Client Quick Contact & SLA Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Contact details */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 glass-panel space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Building2 size={14} className="text-emerald-400" />
            Contact Information
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 text-[11px] block">Contact Person:</span>
              <span className="text-slate-100 font-medium text-sm">
                {client.contact_person || "Not designated"}
              </span>
            </div>

            <div>
              <span className="text-slate-400 text-[11px] block">Official Email:</span>
              {client.email ? (
                <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                  <a
                    href={`mailto:${client.email}`}
                    className="text-indigo-400 hover:underline flex items-center gap-1 font-mono min-w-0 break-all"
                  >
                    <Mail size={12} />
                    {client.email}
                  </a>
                  <CopyButton text={client.email} />
                </div>
              ) : (
                <span className="text-slate-500 italic">No email</span>
              )}
            </div>

            {/* Primary Phone with Call and WhatsApp actions */}
            <div>
              <span className="text-slate-400 text-[11px] block">Primary Phone:</span>
              {client.phone_primary ? (
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="font-mono text-slate-200 font-medium whitespace-nowrap">
                    {client.phone_primary}
                  </span>
                  <CopyButton text={client.phone_primary} />

                  {/* WhatsApp Quick Action */}
                  <a
                    href={`https://wa.me/${cleanPhone(client.phone_primary)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 px-2 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                    title="Open in WhatsApp"
                  >
                    <MessageSquare size={12} />
                    <span>WhatsApp</span>
                  </a>

                  {/* Tel Quick Action */}
                  <a
                    href={`tel:${client.phone_primary}`}
                    className="p-1 px-2 rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                    title="Call"
                  >
                    <Phone size={12} />
                    <span>Call</span>
                  </a>
                </div>
              ) : (
                <span className="text-slate-500 italic">No phone</span>
              )}
            </div>

            {client.phone_secondary && (
              <div>
                <span className="text-slate-400 text-[11px] block">Secondary Phone:</span>
                <div className="flex items-center gap-2 mt-0.5 font-mono text-slate-300">
                  <span>{client.phone_secondary}</span>
                  <CopyButton text={client.phone_secondary} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Physical Address & Location */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 glass-panel space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <MapPin size={14} className="text-sky-400" />
            Office & Billing Address
          </h2>
          <div className="text-xs text-slate-300">
            {client.address ? (
              <p className="leading-relaxed whitespace-pre-line">{client.address}</p>
            ) : (
              <p className="text-slate-500 italic">No address provided</p>
            )}
          </div>
          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Account Status:</span>
              <span className="text-emerald-400 font-medium">In Good Standing</span>
            </div>
            <div className="flex justify-between">
              <span>Last Profile Update:</span>
              <span className="font-mono text-slate-300">{formatDate(client.updated_at)}</span>
            </div>
          </div>
        </div>

        {/* SLA Notes & Account Context */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 glass-panel space-y-4 md:col-span-2 xl:col-span-1">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <FileText size={14} className="text-amber-400" />
            Support Agreement & Notes
          </h2>
          <div className="text-xs text-slate-300">
            {client.notes ? (
              <p className="leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                {client.notes}
              </p>
            ) : (
              <p className="text-slate-500 italic">No notes recorded for this client.</p>
            )}
          </div>
        </div>
      </div>

      {/* Employees whose server accounts can open this company */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <KeyRound size={18} className="text-teal-400" />
            Users with access ({access.length})
          </h2>
          <Link href="/employees" className="text-sm font-semibold text-teal-400 hover:underline flex items-center gap-1.5">
            <Contact size={15} /> Employees
          </Link>
        </div>
        {access.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            No employee accounts can open this company yet. Add them from the Employees page.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {access.map((a) => (
              <Link
                key={a.id}
                href={`/employees/${a.employee_id}`}
                className={`p-3 rounded-xl border flex items-center gap-3 hover:border-teal-500/40 transition-colors ${
                  a.is_active ? "bg-slate-950/50 border-slate-800" : "bg-slate-950/30 border-slate-800/60 opacity-70"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-100 truncate">{a.employee_name}</div>
                  <div className="text-xs text-slate-400 truncate">
                    <span className="font-mono text-teal-300">{a.username}</span> on {a.server_name}
                    {!a.is_active && " (disabled)"}
                  </div>
                  <div className="text-xs text-emerald-300/90 truncate mt-0.5">
                    {a.deployments
                      .filter((d) => d.client_id.toLowerCase() === id.toLowerCase())
                      .map((d) => d.solution_name)
                      .join(", ")}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Solutions Deployed for This Client */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 glass-panel space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers size={18} className="text-indigo-400" />
              Active Solutions Deployed ({client.deployments?.length || 0})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live software stacks, server connections, domains, and renewals for {client.company_name}
            </p>
          </div>

          <button
            onClick={() => openNewDeployment(client.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors self-start sm:self-auto"
          >
            <Plus size={14} />
            <span>Add Solution</span>
          </button>
        </div>

        {client.deployments && client.deployments.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {client.deployments.map((dep) => (
              <div
                key={dep.id}
                className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700/80 transition-all space-y-4"
              >
                {/* Header row: Solution Name, Environment, Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 p-2.5 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-600/20">
                      <Layers size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-white flex flex-wrap items-center gap-2">
                        {dep.solution?.name}
                        <EnvironmentBadge env={dep.environment} />
                      </h3>
                      <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <span className="text-indigo-400 font-mono">{dep.solution?.category}</span>
                        <span>•</span>
                        <span className="font-mono">{dep.version_installed || "v1.0.0"}</span>
                        <span>•</span>
                        <span>License: {dep.license_type.replace(/_/g, " ").toLowerCase()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <StatusBadge status={dep.deployment_status} />
                    <RenewalBadge date={dep.renewal_date} status={dep.deployment_status} />
                    <button
                      onClick={() => openEditDeployment(dep)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-2"
                      title="Edit Deployment"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteDeployment(dep.id, dep.solution?.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Delete Deployment"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Technical Footprint Grid: Domain, Server, Database, SLA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800/80 text-xs">
                  {/* Instance Domain */}
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">Instance Domain / URL</span>
                    {dep.instance_url ? (
                      <div className="flex items-center gap-1.5 font-mono font-medium text-slate-200">
                        <a
                          href={`https://${dep.instance_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline flex items-center gap-1 text-indigo-300"
                        >
                          <span className="truncate max-w-[150px]">{dep.instance_url}</span>
                          <ExternalLink size={11} />
                        </a>
                        <CopyButton text={dep.instance_url} />
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">No domain mapped</span>
                    )}
                  </div>

                  {/* Server Details */}
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">Hosting Server</span>
                    {dep.server ? (
                      <div>
                        <div className="text-slate-200 font-medium flex items-center gap-1">
                          <ServerIcon size={12} className="text-sky-400" />
                          <span>{dep.server.server_name}</span>
                        </div>
                        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400 mt-0.5">
                          <span>{dep.server.ip_address}</span>
                          <CopyButton text={dep.server.ip_address} />
                          <span className="text-slate-500">({dep.server.provider})</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">External SaaS / Cloud</span>
                    )}
                  </div>

                  {/* Database Name */}
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">Database Schema</span>
                    {dep.database_name ? (
                      <div className="flex items-center gap-1 font-mono text-slate-200">
                        <span>{dep.database_name}</span>
                        <CopyButton text={dep.database_name} />
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">Default</span>
                    )}
                  </div>

                  {/* Support Contract */}
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">Support SLA</span>
                    <div className="flex items-center gap-1.5 font-medium text-slate-200">
                      <ShieldCheck size={14} className="text-emerald-400" />
                      <span>{dep.support_contract_status}</span>
                    </div>
                  </div>
                </div>

                {/* Deployment Notes if present */}
                {dep.notes && (
                  <div className="text-xs text-slate-400 bg-slate-900/50 p-3 rounded-lg border border-slate-800/60">
                    <span className="text-slate-300 font-medium">Ops Notes: </span>
                    {dep.notes}
                  </div>
                )}

                {/* Employees who can open this deployment */}
                {(() => {
                  const users = access.filter((a) => a.deployments.some((d) => d.id.toLowerCase() === dep.id.toLowerCase()));
                  return (
                    <div className="pt-2 border-t border-slate-800/80">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <KeyRound size={13} className="text-teal-400" />
                          Employees with access ({users.length})
                        </span>
                        {dep.server && dep.server_id && (
                          <button
                            type="button"
                            onClick={() =>
                              setAccessFor({
                                id: dep.id,
                                title: `${client.company_name} • ${dep.solution?.name || "Solution"}${dep.database_name ? ` • ${dep.database_name}` : ""}`,
                                serverId: dep.server_id!,
                                serverName: dep.server!.server_name,
                              })
                            }
                            className="shrink-0 text-xs font-semibold text-teal-400 hover:underline px-1 py-1"
                          >
                            Manage access
                          </button>
                        )}
                      </div>
                      {users.length ? (
                        <div className="flex flex-wrap gap-2">
                          {users.map((a) => (
                            <Link key={a.id} href={`/employees/${a.employee_id}`} className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-teal-500/40 text-xs ${a.is_active ? "" : "opacity-60"}`}>
                              <span className="font-mono font-semibold text-teal-300">{a.username}</span>
                              <span className="text-slate-300">{a.employee_name}</span>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">
                          <span className="italic">No employee can open this deployment yet.</span>{" "}
                          {!dep.server && (
                            <span className="text-amber-300/90">Set its Hosting Server first (Edit), then you can give access.</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Credentials Vault for this deployment */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Key size={13} className="text-amber-400" />
                      Encrypted Credentials Vault
                    </span>
                    <button
                      onClick={() => {
                        setSelectedDeploymentId(dep.id);
                        setIsAddCredOpen(true);
                      }}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                    >
                      <Plus size={12} /> Add Key
                    </button>
                  </div>

                  {dep.credentials && dep.credentials.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {dep.credentials.map((cred) => {
                        const isVisible = showSecret[cred.id];
                        return (
                          <div
                            key={cred.id}
                            className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-[11px] text-slate-400 truncate">{cred.key_label}</div>
                              <div className="font-mono text-slate-200 mt-0.5 truncate">
                                {isVisible ? secretValues[cred.id] : "••••••••••••••••"}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => toggleShowSecret(cred.id)}
                                className="p-1 text-slate-400 hover:text-white rounded"
                                title={isVisible ? "Hide" : "Reveal"}
                              >
                                {isVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                              <button
                                onClick={() => copySecret(cred.id)}
                                className="p-1 text-slate-400 hover:text-white rounded"
                                title="Copy secret"
                                aria-label={`Copy ${cred.key_label}`}
                              >
                                {copiedCred === cred.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                              </button>
                              <button
                                onClick={() => handleDeleteCredential(cred.id)}
                                className="p-1 text-slate-400 hover:text-rose-400 rounded"
                                title="Delete Key"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic py-1">
                      No credentials stored in vault for this deployment.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-slate-400 space-y-2">
            <Layers size={28} className="mx-auto text-slate-500 mb-2" />
            <p className="text-slate-300 font-medium">No active solutions deployed yet</p>
            <p className="text-slate-500">Deploy ERP, POS, or Mobile Apps to connect this client.</p>
            <button
              onClick={() => openNewDeployment(client.id)}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              <PlusCircle size={14} /> Deploy Solution
            </button>
          </div>
        )}
      </div>

      {accessFor && (
        <DeploymentAccessModal
          deployment={accessFor}
          onClose={() => setAccessFor(null)}
          onSaved={() => triggerRefresh()}
        />
      )}

      {/* Add Credential Modal Dialog */}
      {isAddCredOpen && (
        <ModalShell onClose={() => setIsAddCredOpen(false)} busy={credLoading} size="sm">
          <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-3.5 sm:py-5 border-b border-slate-800 shrink-0">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Key size={18} className="text-amber-400" />
              Add Encrypted Vault Key
            </h3>
            <ModalCloseButton onClick={() => setIsAddCredOpen(false)} disabled={credLoading} />
          </div>
          <div className="overflow-y-auto overscroll-contain min-h-0 p-5 sm:p-7 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-7">
            <form onSubmit={handleAddCredential} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Key Label (e.g. DB Password, API Secret, SSH Key)
                </label>
                <input
                  type="text"
                  required
                  value={credKey}
                  onChange={(e) => setCredKey(e.target.value)}
                  placeholder="e.g. Production DB Password"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Secret Value
                </label>
                <input
                  type="text"
                  required
                  value={credValue}
                  onChange={(e) => setCredValue(e.target.value)}
                  placeholder="Secret payload..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCredOpen(false)}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={credLoading}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-50"
                >
                  {credLoading ? "Saving..." : "Store in Vault"}
                </button>
              </div>
            </form>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
