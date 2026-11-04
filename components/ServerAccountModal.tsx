"use client";

import React, { useEffect, useState } from "react";
import ModalShell, { ModalCloseButton } from "@/components/ModalShell";
import { Save, AlertCircle, KeyRound, Eye, EyeOff, Building2 } from "lucide-react";
import { AccountDeployment, Server, ServerAccount } from "@/types";
import { useFeedback } from "@/components/Feedback";

const inputCls =
  "w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none";

export default function ServerAccountModal({
  isOpen,
  onClose,
  onSaved,
  employeeId,
  employeeName,
  accountToEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  employeeId: string;
  employeeName: string;
  accountToEdit?: ServerAccount | null;
}) {
  const { toast } = useFeedback();
  const isEditing = !!accountToEdit;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [servers, setServers] = useState<Server[]>([]);
  const [deployments, setDeployments] = useState<AccountDeployment[]>([]);
  const [deploymentsLoading, setDeploymentsLoading] = useState(false);

  const [serverId, setServerId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [clearPassword, setClearPassword] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");

  // Fill / reset when opened
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setServerId(accountToEdit?.server_id || "");
    setUsername(accountToEdit?.username || "");
    setPassword("");
    setShowPassword(false);
    setClearPassword(false);
    setSelected(new Set((accountToEdit?.deployments || []).map((d) => d.id.toLowerCase())));
    setIsActive(accountToEdit ? accountToEdit.is_active : true);
    setNotes(accountToEdit?.notes || "");
    fetch("/api/servers")
      .then((r) => r.json())
      .then((d) => d.success && setServers(d.data))
      .catch(() => {});
  }, [isOpen, accountToEdit]);

  // What can be ticked = the deployments on the chosen server
  useEffect(() => {
    if (!isOpen || !serverId) {
      setDeployments([]);
      return;
    }
    let cancelled = false;
    setDeploymentsLoading(true);
    fetch(`/api/servers/${serverId}/deployments`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.success) return;
        setDeployments(d.data);
        // drop ticks for deployments that are not on this server
        const allowed = new Set<string>(d.data.map((x: { id: string }) => x.id.toLowerCase()));
        setSelected((prev) => new Set([...prev].filter((id) => allowed.has(id))));
      })
      .catch(() => {})
      .finally(() => !cancelled && setDeploymentsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isOpen, serverId]);

  if (!isOpen) return null;

  // one group per company, in the order the API returns them
  const groups: Array<{ clientId: string; name: string; items: AccountDeployment[] }> = [];
  for (const d of deployments) {
    const g = groups.find((x) => x.clientId === d.client_id);
    if (g) g.items.push(d);
    else groups.push({ clientId: d.client_id, name: d.company_name, items: [d] });
  }

  const setGroup = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const key = id.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverId) return setError("Choose a server.");
    if (!username.trim()) return setError("Username is required.");
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        server_id: serverId,
        username: username.trim(),
        deployment_ids: [...selected],
        is_active: isActive,
        notes: notes.trim() || null,
      };
      if (!isEditing) body.employee_id = employeeId;
      if (clearPassword) body.clear_password = true;
      else if (password) body.password = password;

      const res = await fetch(isEditing ? `/api/server-accounts/${accountToEdit!.id}` : "/api/server-accounts", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to save account");
      toast(isEditing ? `Account ${data.data.username} updated.` : `Account ${data.data.username} added on ${data.data.server_name}.`);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} busy={loading} size="lg" labelledBy="account-modal-title">
      <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-3.5 sm:py-5 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 shrink-0">
            <KeyRound size={20} />
          </div>
          <div className="min-w-0">
            <h3 id="account-modal-title" className="text-lg font-bold text-white">
              {isEditing ? "Edit Server Account" : "Add Server Account"}
            </h3>
            <p className="text-xs text-slate-400 truncate">for {employeeName}</p>
          </div>
        </div>
        <ModalCloseButton onClick={onClose} disabled={loading} />
      </div>

      <form onSubmit={handleSubmit} className="overflow-y-auto overscroll-contain min-h-0 flex-1 px-5 sm:px-7 pt-5 sm:pt-6 space-y-5">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Server <span className="text-rose-400">*</span>
            </label>
            <select value={serverId} onChange={(e) => setServerId(e.target.value)} className={inputCls} required>
              <option value="">Choose a server…</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.server_name} ({s.ip_address})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Username <span className="text-rose-400">*</span>
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. mohamad1"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className={`${inputCls} font-mono`}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Password (optional, saved encrypted)</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={clearPassword}
              autoComplete="new-password"
              placeholder={isEditing && accountToEdit?.has_password ? "Leave empty to keep the saved password" : "Leave empty if you don't want to save it"}
              className={`${inputCls} font-mono pr-12 disabled:opacity-50`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 inline-flex items-center justify-center text-slate-400 hover:text-white rounded-lg"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {isEditing && accountToEdit?.has_password && (
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
              <input type="checkbox" checked={clearPassword} onChange={(e) => setClearPassword(e.target.checked)} className="w-4 h-4 accent-rose-500" />
              Remove the saved password
            </label>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">What this account can open</label>
          {!serverId ? (
            <p className="text-sm text-slate-500 italic p-3 rounded-xl border border-dashed border-slate-700">Choose a server first.</p>
          ) : deploymentsLoading ? (
            <p className="text-sm text-slate-400 p-3">Loading deployments…</p>
          ) : deployments.length === 0 ? (
            <p className="text-sm text-amber-300/90 p-3 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5">
              Nothing is deployed on this server yet. Add a deployment on this server first;
              you can still save the account without access.
            </p>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => {
                const ids = g.items.map((d) => d.id.toLowerCase());
                const allOn = ids.every((id) => selected.has(id));
                return (
                  <div key={g.clientId} className="rounded-xl border border-slate-700 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-800/70">
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-100 min-w-0">
                        <Building2 size={15} className="text-emerald-400 shrink-0" />
                        <span className="truncate">{g.name}</span>
                      </span>
                      {ids.length > 1 && (
                        <button type="button" onClick={() => setGroup(ids, !allOn)} className="shrink-0 text-xs font-semibold text-teal-400 hover:underline px-1 py-1">
                          {allOn ? "Clear all" : "Select all"}
                        </button>
                      )}
                    </div>
                    <div className="divide-y divide-slate-800">
                      {g.items.map((d) => {
                        const on = selected.has(d.id.toLowerCase());
                        return (
                          <label key={d.id} className={`flex items-center gap-3 px-3.5 py-3 cursor-pointer select-none transition-colors ${on ? "bg-teal-500/10" : "hover:bg-slate-800/40"}`}>
                            <input type="checkbox" checked={on} onChange={() => toggle(d.id)} className="w-5 h-5 accent-teal-500 shrink-0" />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-slate-100 truncate">{d.solution_name}</span>
                              <span className="block text-xs font-mono text-slate-400 truncate">
                                {[d.database_name || "no database name", d.environment].filter(Boolean).join(" • ")}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. read-only role, created on request #123" className={inputCls} />
        </div>

        <label className="flex items-center gap-3 text-sm text-slate-200 cursor-pointer select-none">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-5 h-5 accent-teal-500" />
          Account is active
        </label>

        <div className="sticky bottom-0 z-10 -mx-5 sm:-mx-7 px-5 sm:px-7 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6 bg-slate-900 border-t border-slate-800 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
          <button type="button" onClick={onClose} disabled={loading} className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold shadow-md shadow-teal-600/20 transition-all disabled:opacity-50">
            <Save size={18} />
            <span>{loading ? "Saving..." : isEditing ? "Save Changes" : "Add Account"}</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
