"use client";

import { useRevealError } from "@/components/useRevealError";
import React, { useEffect, useState } from "react";
import ModalShell, { ModalCloseButton } from "@/components/ModalShell";
import { Save, AlertCircle, UserRound } from "lucide-react";
import { Client, Employee } from "@/types";
import { useFeedback } from "@/components/Feedback";

const inputCls =
  "w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none";

export default function EmployeeModal({
  isOpen,
  onClose,
  onSaved,
  employeeToEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (employee: Employee) => void;
  employeeToEdit?: Employee | null;
}) {
  const { toast } = useFeedback();
  const isEditing = !!employeeToEdit;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRevealError(error);
  const [clients, setClients] = useState<Client[]>([]);

  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setFullName(employeeToEdit?.full_name || "");
    setJobTitle(employeeToEdit?.job_title || "");
    setClientId(employeeToEdit?.client_id || "");
    setEmail(employeeToEdit?.email || "");
    setPhone(employeeToEdit?.phone || "");
    setNotes(employeeToEdit?.notes || "");
    setIsActive(employeeToEdit ? employeeToEdit.is_active : true);
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => d.success && setClients(d.data))
      .catch(() => {});
  }, [isOpen, employeeToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Name is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(isEditing ? `/api/employees/${employeeToEdit!.id}` : "/api/employees", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          job_title: jobTitle.trim() || null,
          client_id: clientId || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          notes: notes.trim() || null,
          is_active: isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to save employee");
      toast(isEditing ? `${data.data.full_name} was updated.` : `${data.data.full_name} was added.`);
      onSaved(data.data);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save employee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} busy={loading} size="lg" labelledBy="employee-modal-title">
      <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-3.5 sm:py-5 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400">
            <UserRound size={20} />
          </div>
          <div>
            <h3 id="employee-modal-title" className="text-lg font-bold text-white">
              {isEditing ? "Edit Employee" : "Add Employee"}
            </h3>
            <p className="text-xs text-slate-400">A person who logs in to systems on your servers</p>
          </div>
        </div>
        <ModalCloseButton onClick={onClose} disabled={loading} />
      </div>

      <form onSubmit={handleSubmit} className="overflow-y-auto overscroll-contain min-h-0 flex-1 px-5 sm:px-7 pt-5 sm:pt-6 space-y-5">
        {error && (
          <div ref={errorRef} className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Full name <span className="text-rose-400">*</span>
          </label>
          <input autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Mohamad Haddad" className={inputCls} required />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Works for (company)</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
              <option value="">— Not linked —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Job title</label>
            <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Accountant" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+961 ..." className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything useful for support" className={inputCls} />
        </div>

        <label className="flex items-center gap-3 text-sm text-slate-200 cursor-pointer select-none">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-5 h-5 accent-teal-500" />
          Active employee
        </label>

        <div className="sticky bottom-0 z-10 -mx-5 sm:-mx-7 px-5 sm:px-7 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6 bg-slate-900 border-t border-slate-800 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
          <button type="button" onClick={onClose} disabled={loading} className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold shadow-md shadow-teal-600/20 transition-all disabled:opacity-50">
            <Save size={18} />
            <span>{loading ? "Saving..." : isEditing ? "Save Changes" : "Add Employee"}</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
