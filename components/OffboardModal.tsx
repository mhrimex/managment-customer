"use client";

import React, { useState } from "react";
import { AlertCircle, Check, ClipboardList, Copy, UserMinus } from "lucide-react";
import ModalShell, { ModalCloseButton } from "@/components/ModalShell";
import { useRevealError } from "@/components/useRevealError";
import { Employee } from "@/types";

/** The list of logins to remove on the real servers, as plain text for an email or a ticket. */
function checklistText(employee: Employee) {
  const lines = [`${employee.full_name}${employee.job_title ? ` (${employee.job_title})` : ""} has left. Remove these logins:`, ""];
  for (const a of employee.accounts || []) {
    lines.push(`- ${a.server_name} (${a.server_ip}): user "${a.username}"`);
    for (const d of a.deployments) {
      lines.push(`    ${d.company_name} - ${d.solution_name}${d.database_name ? ` - database ${d.database_name}` : ""}`);
    }
    if (!a.deployments.length) lines.push("    (no solutions recorded)");
  }
  if (!(employee.accounts || []).length) lines.push("(no server accounts recorded)");
  return lines.join("\n");
}

/**
 * "Employee leaving": confirm, then show the removal checklist.
 * Opened on an employee who already left, it shows the checklist straight away.
 */
export default function OffboardModal({
  employee,
  onClose,
  onDone,
}: {
  employee: Employee;
  onClose: () => void;
  onDone: (updated: Employee) => void;
}) {
  const accounts = employee.accounts || [];
  const pending = employee.is_active || accounts.some((a) => a.is_active);
  const [done, setDone] = useState<Employee | null>(pending ? null : employee);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRevealError(error);
  const active = accounts.filter((a) => a.is_active).length;

  const confirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${employee.id}/offboard`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || "Failed to process the employee leaving");
      setDone(data.data.employee);
      onDone(data.data.employee);
    } catch (err: any) {
      setError(err.message || "Failed to process the employee leaving");
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    const text = checklistText(done || employee);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shown = done || employee;

  return (
    <ModalShell onClose={onClose} busy={saving} size="lg" labelledBy="offboard-title">
      <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-3.5 sm:py-5 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2.5 rounded-xl shrink-0 ${done ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
            {done ? <ClipboardList size={20} /> : <UserMinus size={20} />}
          </div>
          <div className="min-w-0">
            <h3 id="offboard-title" className="text-lg font-bold text-white">
              {done ? "Removal checklist" : "Employee leaving"}
            </h3>
            <p className="text-xs text-slate-400 truncate">{employee.full_name}</p>
          </div>
        </div>
        <ModalCloseButton onClick={onClose} disabled={saving} />
      </div>

      <div className="overflow-y-auto overscroll-contain min-h-0 flex-1 px-5 sm:px-7 py-5 space-y-4">
        {error && (
          <div ref={errorRef} className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <p className="text-sm text-slate-300">
          {done
            ? "Done here: the employee is inactive and every account is disabled. Now remove these logins on the real servers. The accounts stay in this app as a record; an admin can delete them later."
            : `This marks ${employee.full_name} as inactive and disables ${active} server account(s) in this app. It does not change the real servers: you get a checklist of what to remove there.`}
        </p>

        {shown.accounts && shown.accounts.length ? (
          <div className="space-y-3">
            {shown.accounts.map((a) => (
              <div key={a.id} className="rounded-xl border border-slate-700 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-slate-100 [overflow-wrap:anywhere]">{a.username}</span>
                  <span className="text-xs text-slate-400 shrink-0">
                    {a.server_name} · {a.server_ip}
                  </span>
                </div>
                {a.deployments.length ? (
                  <ul className="mt-2 space-y-1 text-sm text-slate-300">
                    {a.deployments.map((d) => (
                      <li key={d.id} className="[overflow-wrap:anywhere]">
                        {d.company_name} · {d.solution_name}
                        {d.database_name && <span className="font-mono text-slate-400"> · {d.database_name}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-slate-500 italic">No solutions recorded</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">No server accounts recorded.</p>
        )}
      </div>

      <div className="shrink-0 px-5 sm:px-7 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6 border-t border-slate-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <button type="button" onClick={onClose} disabled={saving} className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold">
          {done ? "Close" : "Cancel"}
        </button>
        {done ? (
          <button type="button" onClick={copy} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold">
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? "Copied" : "Copy checklist"}
          </button>
        ) : (
          <button type="button" onClick={confirm} disabled={saving} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold disabled:opacity-50">
            <UserMinus size={18} />
            {saving ? "Saving..." : `Disable ${active} account(s)`}
          </button>
        )}
      </div>
    </ModalShell>
  );
}
