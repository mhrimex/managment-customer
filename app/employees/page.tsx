"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Contact, PlusCircle, Search, X, Server as ServerIcon, Building2, Mail, Phone, ArrowUpRight } from "lucide-react";
import { Employee } from "@/types";
import { SkeletonCards } from "@/components/Skeleton";
import { useFeedback } from "@/components/Feedback";
import EmployeeModal from "@/components/EmployeeModal";
import { initials } from "@/lib/utils";

export default function EmployeesPage() {
  const { toast } = useFeedback();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(
    (q: string) => {
      setLoading(true);
      fetch(`/api/employees${q.trim() ? `?search=${encodeURIComponent(q.trim())}` : ""}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setEmployees(d.data);
          else toast(d.error || "Failed to load employees", "error");
        })
        .catch(() => toast("Could not load employees", "error"))
        .finally(() => setLoading(false));
    },
    [toast]
  );

  // search as you type (small delay)
  useEffect(() => {
    const t = setTimeout(() => load(search), 250);
    return () => clearTimeout(t);
  }, [search, load]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-teal-400 mb-2">
            <Contact size={16} />
            <span>People & Logins</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Employees</h1>
          <p className="text-base text-slate-400 mt-2">
            People who use the systems on your servers, their usernames on each server, and what they can open
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="self-start sm:self-auto flex items-center gap-2 px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold shadow-md shadow-teal-600/20 transition-all"
        >
          <PlusCircle size={18} />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, username, company…"
          className="w-full pl-11 pr-11 py-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center text-slate-400 hover:text-white" aria-label="Clear search">
            <X size={16} />
          </button>
        )}
      </div>

      {/* List */}
      {loading && employees.length === 0 ? (
        <SkeletonCards count={6} />
      ) : employees.length === 0 ? (
        <div className="py-20 text-center rounded-2xl border-2 border-dashed border-slate-800">
          <Contact size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-lg font-bold text-slate-200">{search ? `No employee matches "${search}"` : "No employees yet"}</p>
          {!search && (
            <>
              <p className="text-sm text-slate-400 mt-1 mb-6">Add a person, then give them a username on each server they use.</p>
              <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold">
                <PlusCircle size={18} /> Add your first employee
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {employees.map((e) => (
            <Link
              key={e.id}
              href={`/employees/${e.id}`}
              className="group rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-teal-500/40 hover:-translate-y-0.5 hover:shadow-xl transition-all p-5 glass-panel flex flex-col gap-4"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white font-display font-extrabold flex items-center justify-center shrink-0">
                  {initials(e.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-lg text-slate-100 truncate group-hover:text-teal-300">{e.full_name}</h3>
                    {!e.is_active && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-700/60 text-slate-300">Inactive</span>
                    )}
                  </div>
                  <div className="text-sm text-slate-400 truncate">
                    {[e.job_title, e.client_name].filter(Boolean).join(" • ") || "—"}
                  </div>
                </div>
                <ArrowUpRight size={18} className="text-slate-600 group-hover:text-teal-400 shrink-0" />
              </div>

              {(e.email || e.phone) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                  {e.email && <span className="flex items-center gap-1.5 min-w-0"><Mail size={14} className="shrink-0" /><span className="truncate">{e.email}</span></span>}
                  {e.phone && <span className="flex items-center gap-1.5"><Phone size={14} />{e.phone}</span>}
                </div>
              )}

              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                {(e.accounts || []).length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No server accounts yet</p>
                ) : (
                  (e.accounts || []).map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm min-w-0">
                      <ServerIcon size={14} className="text-sky-400 shrink-0" />
                      <span className="text-slate-300 truncate max-w-[40%]">{a.server_name}</span>
                      <span className="font-mono font-semibold text-teal-300 truncate">{a.username}</span>
                      <span className="ml-auto flex items-center gap-1 text-xs text-slate-400 shrink-0" title={a.deployments.map((d) => `${d.company_name} – ${d.solution_name}`).join(", ")}>
                        <Building2 size={13} />
                        {a.deployments.length}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <EmployeeModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSaved={() => load(search)} />
    </div>
  );
}
