"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Edit3, Trash2, Mail, Phone, Building2, Server as ServerIcon, KeyRound, PlusCircle,
  Eye, EyeOff, Copy, Check, StickyNote, Briefcase,
} from "lucide-react";
import { Employee, ServerAccount } from "@/types";
import { useFeedback } from "@/components/Feedback";
import { Skeleton, SkeletonCards } from "@/components/Skeleton";
import CopyButton from "@/components/CopyButton";
import EmployeeModal from "@/components/EmployeeModal";
import ServerAccountModal from "@/components/ServerAccountModal";
import { initials } from "@/lib/utils";

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast, confirm } = useFeedback();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [accountModal, setAccountModal] = useState<{ open: boolean; account: ServerAccount | null }>({ open: false, account: null });

  // revealed passwords live only in memory while the page is open
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/employees/${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (r.status === 404) setNotFound(true);
        else if (d.success) setEmployee(d.data);
        else toast(d.error || "Failed to load employee", "error");
      })
      .catch(() => toast("Could not load employee", "error"))
      .finally(() => setLoading(false));
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const fetchPassword = async (acc: ServerAccount, purpose: "reveal" | "copy") => {
    try {
      const r = await fetch(`/api/server-accounts/${acc.id}/password?purpose=${purpose}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Could not read the password");
      return d.data.password as string;
    } catch (err: any) {
      toast(err.message, "error");
      return null;
    }
  };

  const togglePassword = async (acc: ServerAccount) => {
    if (passwords[acc.id] !== undefined) {
      setPasswords(({ [acc.id]: _drop, ...rest }) => rest);
      return;
    }
    const pw = await fetchPassword(acc, "reveal");
    if (pw !== null) setPasswords((p) => ({ ...p, [acc.id]: pw }));
  };

  const copyPassword = async (acc: ServerAccount) => {
    const pw = passwords[acc.id] ?? (await fetchPassword(acc, "copy"));
    if (pw === null) return;
    try {
      await navigator.clipboard.writeText(pw);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = pw;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(acc.id);
    setTimeout(() => setCopied((c) => (c === acc.id ? null : c)), 2000);
  };

  const deleteEmployee = async () => {
    if (!employee) return;
    const n = employee.accounts?.length || 0;
    const ok = await confirm({
      title: `Delete ${employee.full_name}?`,
      message: n ? `Their ${n} server account(s) will be deleted too.` : "The employee will be removed.",
      confirmLabel: "Delete employee",
      danger: true,
    });
    if (!ok) return;
    const r = await fetch(`/api/employees/${employee.id}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok || !d.success) return toast(d.error || "Failed to delete employee", "error");
    toast(`${employee.full_name} was deleted.`);
    router.push("/employees");
  };

  const deleteAccount = async (acc: ServerAccount) => {
    const ok = await confirm({
      title: `Delete account ${acc.username}?`,
      message: `The login "${acc.username}" on ${acc.server_name} and its access will be removed from this list.`,
      confirmLabel: "Delete account",
      danger: true,
    });
    if (!ok) return;
    const r = await fetch(`/api/server-accounts/${acc.id}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok || !d.success) return toast(d.error || "Failed to delete account", "error");
    toast(`Account ${acc.username} was deleted.`);
    load();
  };

  if (loading && !employee) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <SkeletonCards count={2} />
      </div>
    );
  }

  if (notFound || !employee) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-bold text-slate-200">Employee not found</p>
        <Link href="/employees" className="inline-flex items-center gap-2 mt-4 text-teal-400 hover:underline">
          <ArrowLeft size={16} /> Back to employees
        </Link>
      </div>
    );
  }

  const accounts = employee.accounts || [];

  return (
    <div className="space-y-6">
      <Link href="/employees" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft size={16} /> Employees
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white font-display text-2xl font-extrabold flex items-center justify-center shrink-0">
            {initials(employee.full_name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-extrabold text-white tracking-tight">{employee.full_name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${employee.is_active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-slate-700/40 text-slate-300 border-slate-600"}`}>
                {employee.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="text-base text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              {employee.job_title && <span className="flex items-center gap-1.5"><Briefcase size={15} />{employee.job_title}</span>}
              {employee.client_id && employee.client_name && (
                <Link href={`/clients/${employee.client_id}`} className="flex items-center gap-1.5 text-emerald-400 hover:underline">
                  <Building2 size={15} />{employee.client_name}
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setEditOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700">
            <Edit3 size={16} /> Edit
          </button>
          <button onClick={deleteEmployee} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-sm font-semibold border border-rose-500/30">
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      {/* Contact + notes */}
      {(employee.email || employee.phone || employee.notes) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(employee.email || employee.phone) && (
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 glass-panel space-y-3 text-sm">
              {employee.email && (
                <div className="flex items-center gap-2.5 min-w-0">
                  <Mail size={16} className="text-slate-400 shrink-0" />
                  <a href={`mailto:${employee.email}`} className="text-slate-200 hover:underline truncate">{employee.email}</a>
                  <CopyButton text={employee.email} />
                </div>
              )}
              {employee.phone && (
                <div className="flex items-center gap-2.5">
                  <Phone size={16} className="text-slate-400 shrink-0" />
                  <a href={`tel:${employee.phone}`} className="text-slate-200 hover:underline font-mono">{employee.phone}</a>
                  <CopyButton text={employee.phone} />
                </div>
              )}
            </div>
          )}
          {employee.notes && (
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 glass-panel text-sm">
              <div className="flex items-center gap-2 text-slate-400 mb-2"><StickyNote size={16} /> Notes</div>
              <p className="text-slate-200 whitespace-pre-line">{employee.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Server accounts */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 glass-panel p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <KeyRound size={20} className="text-teal-400" /> Server accounts ({accounts.length})
            </h2>
            <p className="text-sm text-slate-400 mt-1">One username per server. The same username can exist on other servers.</p>
          </div>
          <button
            onClick={() => setAccountModal({ open: true, account: null })}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold"
          >
            <PlusCircle size={17} /> Add account
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="py-10 text-center rounded-xl border-2 border-dashed border-slate-800">
            <p className="text-slate-300 font-semibold">No server accounts yet</p>
            <p className="text-sm text-slate-500 mt-1">Add the username {employee.full_name.split(" ")[0]} uses on each server.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {accounts.map((a) => {
              const shown = passwords[a.id];
              return (
                <div key={a.id} className={`p-4 sm:p-5 rounded-xl border space-y-4 ${a.is_active ? "bg-slate-950/60 border-slate-800" : "bg-slate-950/30 border-slate-800/60 opacity-75"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href="/servers" className="flex items-center gap-2 text-sm text-sky-300 hover:underline min-w-0">
                        <ServerIcon size={15} className="shrink-0" />
                        <span className="font-semibold truncate">{a.server_name}</span>
                      </Link>
                      <div className="text-xs font-mono text-slate-500 mt-0.5 ml-[23px] truncate">{a.server_ip}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-lg font-bold text-white [overflow-wrap:anywhere]">{a.username}</span>
                        <CopyButton text={a.username} />
                        {!a.is_active && <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-700/60 text-slate-300">Disabled</span>}
                      </div>
                    </div>
                    <div className="flex items-center shrink-0">
                      <button onClick={() => setAccountModal({ open: true, account: a })} className="w-10 h-10 inline-flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800" aria-label={`Edit ${a.username}`} title="Edit account">
                        <Edit3 size={17} />
                      </button>
                      <button onClick={() => deleteAccount(a)} className="w-10 h-10 inline-flex items-center justify-center text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800" aria-label={`Delete ${a.username}`} title="Delete account">
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-xs text-slate-400 w-16 shrink-0">Password</span>
                    {a.has_password ? (
                      <>
                        <span className="font-mono text-sm text-slate-200 truncate flex-1">{shown !== undefined ? shown : "••••••••••"}</span>
                        <button onClick={() => togglePassword(a)} className="w-9 h-9 inline-flex items-center justify-center text-slate-400 hover:text-white rounded-lg" aria-label={shown !== undefined ? "Hide password" : "Reveal password"} title={shown !== undefined ? "Hide" : "Reveal"}>
                          {shown !== undefined ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button onClick={() => copyPassword(a)} className="w-9 h-9 inline-flex items-center justify-center text-slate-400 hover:text-white rounded-lg" aria-label="Copy password" title="Copy">
                          {copied === a.id ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                        </button>
                      </>
                    ) : (
                      <span className="text-sm text-slate-500 italic flex-1">not saved</span>
                    )}
                  </div>

                  {/* What this account can open */}
                  <div>
                    <div className="text-xs text-slate-400 mb-2">Can open ({a.deployments.length})</div>
                    {a.deployments.length ? (
                      <div className="space-y-2">
                        {a.deployments.map((d) => (
                          <Link key={d.id} href={`/clients/${d.client_id}`} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 min-w-0">
                            <Building2 size={15} className="text-emerald-400 shrink-0" />
                            <span className="min-w-0">
                              <span className="block text-xs text-emerald-300/90 [overflow-wrap:anywhere]">{d.company_name}</span>
                              <span className="block text-sm font-semibold text-slate-100 [overflow-wrap:anywhere]">{d.solution_name}</span>
                              {d.database_name && <span className="block text-xs font-mono text-slate-400 [overflow-wrap:anywhere]">{d.database_name}</span>}
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500 italic">Nothing selected</span>
                    )}
                  </div>

                  {a.notes && <p className="text-sm text-slate-400 whitespace-pre-line border-t border-slate-800 pt-3">{a.notes}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <EmployeeModal isOpen={editOpen} onClose={() => setEditOpen(false)} onSaved={() => load()} employeeToEdit={employee} />
      <ServerAccountModal
        isOpen={accountModal.open}
        onClose={() => setAccountModal({ open: false, account: null })}
        onSaved={() => {
          setPasswords({});
          load();
        }}
        employeeId={employee.id}
        employeeName={employee.full_name}
        accountToEdit={accountModal.account}
      />
    </div>
  );
}
