"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, KeyRound, Search } from "lucide-react";
import { AccessReportRow } from "@/types";
import { useFeedback } from "@/components/Feedback";
import { Skeleton } from "@/components/Skeleton";
import { buildXlsx, downloadBlob } from "@/lib/xlsx";

const selectCls =
  "w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none";

const distinct = (values: Array<string | null>) =>
  [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));

export default function AccessReportPage() {
  const { toast } = useFeedback();
  const [rows, setRows] = useState<AccessReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [server, setServer] = useState("");
  const [company, setCompany] = useState("");
  const [solution, setSolution] = useState("");

  useEffect(() => {
    fetch("/api/reports/access", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (r.ok && d?.success) setRows(d.data);
        else setFailed(d?.error || "Could not load the report. Make sure the API and website sites run the same version.");
      })
      .catch(() => setFailed("Could not reach the API."))
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!server || r.server_name === server) &&
        (!company || r.company_name === company) &&
        (!solution || r.solution_name === solution) &&
        (!q ||
          [r.employee_name, r.job_title, r.username, r.server_name, r.server_ip, r.company_name, r.solution_name, r.database_name]
            .some((v) => v?.toLowerCase().includes(q)))
    );
  }, [rows, search, server, company, solution]);

  const exportExcel = () => {
    try {
      const blob = buildXlsx(
        "Access report",
        ["Employee", "Job title", "Employee status", "Username", "Account status", "Server", "Server IP", "Company", "Solution", "Database", "Environment", "Deployment status"],
        shown.map((r) => [
          r.employee_name,
          r.job_title || "",
          r.employee_active ? "Active" : "Inactive",
          r.username || "",
          r.account_id ? (r.account_active ? "Active" : "Disabled") : "",
          r.server_name || "",
          r.server_ip || "",
          r.company_name || "",
          r.solution_name || "",
          r.database_name || "",
          r.environment || "",
          r.deployment_status || "",
        ])
      );
      downloadBlob(blob, `access-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast("Could not create the Excel file", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <KeyRound size={30} className="text-teal-400 shrink-0" /> Access Report
          </h1>
          <p className="text-base text-slate-400 mt-2">Who can open what, on which server and database.</p>
        </div>
        <button
          type="button"
          onClick={exportExcel}
          disabled={loading || shown.length === 0}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-50"
        >
          <Download size={17} /> Export to Excel
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Employee, username, database..."
            aria-label="Search"
            className={`${selectCls} pl-10`}
          />
        </div>
        <select value={server} onChange={(e) => setServer(e.target.value)} aria-label="Server" className={selectCls}>
          <option value="">All servers</option>
          {distinct(rows.map((r) => r.server_name)).map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Company" className={selectCls}>
          <option value="">All companies</option>
          {distinct(rows.map((r) => r.company_name)).map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={solution} onChange={(e) => setSolution(e.target.value)} aria-label="Solution" className={selectCls}>
          <option value="">All solutions</option>
          {distinct(rows.map((r) => r.solution_name)).map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      {failed ? (
        <p className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-sm text-rose-300">{failed}</p>
      ) : loading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <>
          <p className="text-sm text-slate-400">{shown.length} of {rows.length} rows</p>
          {shown.length === 0 ? (
            <div className="py-12 text-center rounded-2xl border-2 border-dashed border-slate-800">
              <p className="text-slate-300 font-semibold">{rows.length ? "Nothing matches these filters" : "No employees yet"}</p>
              {!rows.length && (
                <Link href="/employees" className="inline-block mt-2 text-sm font-semibold text-teal-400 hover:underline">
                  Add employees
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 glass-panel overflow-x-auto">
              <table className="rtable w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800">
                    {["Employee", "Username", "Server", "Company", "Solution", "Database", "Environment"].map((h) => (
                      <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {shown.map((r, i) => (
                    <tr key={`${r.employee_id}-${r.account_id}-${r.deployment_id}-${i}`} className={r.employee_active && r.account_active !== false ? "" : "opacity-60"}>
                      <td data-primary className="px-4 py-3">
                        <Link href={`/employees/${r.employee_id}`} className="font-semibold text-slate-100 hover:underline">{r.employee_name}</Link>
                        {!r.employee_active && <span className="ml-2 text-xs text-slate-400">(inactive)</span>}
                      </td>
                      <td data-label="Username" className="px-4 py-3 font-mono text-teal-300">
                        {r.username ? <span>{r.username}{r.account_active === false ? " (disabled)" : ""}</span> : <span className="text-slate-500 italic font-sans">No account</span>}
                      </td>
                      <td data-label="Server" className="px-4 py-3 text-slate-200">{r.server_name || "-"}</td>
                      <td data-label="Company" className="px-4 py-3">
                        {r.client_id ? (
                          <Link href={`/clients/${r.client_id}`} className="text-slate-200 hover:underline">{r.company_name}</Link>
                        ) : (
                          <span className="text-slate-500 italic">{r.account_id ? "No access" : "-"}</span>
                        )}
                      </td>
                      <td data-label="Solution" className="px-4 py-3 text-slate-200">{r.solution_name || "-"}</td>
                      <td data-label="Database" className="px-4 py-3 font-mono text-slate-300">{r.database_name || "-"}</td>
                      <td data-label="Environment" className="px-4 py-3 text-slate-300">{r.environment || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
