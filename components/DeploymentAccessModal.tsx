"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, KeyRound, Save } from "lucide-react";
import ModalShell, { ModalCloseButton } from "@/components/ModalShell";
import { useFeedback } from "@/components/Feedback";
import { ServerAccount } from "@/types";

/** Tick who can open one deployment. Lists the accounts on the deployment's server. */
export default function DeploymentAccessModal({
  deployment,
  onClose,
  onSaved,
}: {
  deployment: { id: string; title: string; serverId: string; serverName: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useFeedback();
  const [accounts, setAccounts] = useState<ServerAccount[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/server-accounts?server_id=${encodeURIComponent(deployment.serverId)}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!r.ok || !d?.success) throw new Error(d?.error || "Could not load the accounts");
        const list: ServerAccount[] = d.data;
        setAccounts(list);
        setSelected(
          new Set(
            list
              .filter((a) => a.deployments.some((x) => x.id.toLowerCase() === deployment.id.toLowerCase()))
              .map((a) => a.id.toLowerCase())
          )
        );
      })
      .catch((err) => setError(err.message || "Could not load the accounts"))
      .finally(() => setLoading(false));
  }, [deployment.id, deployment.serverId]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const key = id.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/deployments/${deployment.id}/access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_ids: [...selected] }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || "Failed to save access");
      toast("Access updated.");
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save access");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} busy={saving} size="lg" labelledBy="access-modal-title">
      <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-3.5 sm:py-5 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 shrink-0">
            <KeyRound size={20} />
          </div>
          <div className="min-w-0">
            <h3 id="access-modal-title" className="text-lg font-bold text-white">Manage access</h3>
            <p className="text-xs text-slate-400 truncate">{deployment.title} on {deployment.serverName}</p>
          </div>
        </div>
        <ModalCloseButton onClick={onClose} disabled={saving} />
      </div>

      <form onSubmit={save} className="flex flex-col min-h-0 flex-1">
        <div className="overflow-y-auto overscroll-contain min-h-0 flex-1 px-5 sm:px-7 py-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {loading ? (
            <p className="text-sm text-slate-400">Loading accounts…</p>
          ) : accounts.length === 0 && !error ? (
            <div className="p-4 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 text-sm text-amber-300/90">
              No employee has an account on {deployment.serverName} yet.{" "}
              <Link href="/employees" onClick={onClose} className="font-semibold underline">
                Open an employee and choose Add account.
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-400">Tick the accounts that can open this deployment.</p>
              <div className="rounded-xl border border-slate-700 divide-y divide-slate-800 overflow-hidden">
                {accounts.map((a) => {
                  const on = selected.has(a.id.toLowerCase());
                  return (
                    <label key={a.id} className={`flex items-center gap-3 px-3.5 py-3 cursor-pointer select-none transition-colors ${on ? "bg-teal-500/10" : "hover:bg-slate-800/40"}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(a.id)} className="w-5 h-5 accent-teal-500 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm font-mono font-semibold text-slate-100 truncate">{a.username}</span>
                        <span className="block text-xs text-slate-400 truncate">
                          {a.employee_name}{a.is_active ? "" : " (disabled)"}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 px-5 sm:px-7 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6 border-t border-slate-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold">
            Cancel
          </button>
          <button type="submit" disabled={saving || loading || accounts.length === 0} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold disabled:opacity-50">
            <Save size={18} />
            {saving ? "Saving..." : "Save access"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
