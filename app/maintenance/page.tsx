"use client";

import ModalShell from "@/components/ModalShell";
import React, { useState, useEffect, useRef } from "react";
import {
  Database,
  Download,
  UploadCloud,
  Trash2,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Server,
  Building2,
  Layers,
  Key,
  Clock,
  FileCode,
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from "lucide-react";
import { useApp } from "@/components/AppLayoutClient";
import { DashboardMetrics } from "@/types";

export default function MaintenancePage() {
  const { triggerRefresh } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  // Backup State
  const [downloadingBackup, setDownloadingBackup] = useState(false);

  // Restore State
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<any | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Clear / Reset State
  const [confirmModalMode, setConfirmModalMode] = useState<"reset_seed" | "clear_all" | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);

  // Notification banners
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStats = async () => {
    setLoadingMetrics(true);
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      if (data.success) {
        setMetrics(data.data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const showToast = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 6000);
  };

  // 1. Download Backup
  const handleDownloadBackup = async () => {
    setDownloadingBackup(true);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error("Failed to generate backup");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reflection-solutions-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast("success", "Full system backup exported and downloaded successfully.");
    } catch (err: any) {
      showToast("error", err.message || "Failed to download backup.");
    } finally {
      setDownloadingBackup(false);
    }
  };

  // 2. Select & Parse Restore File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    setRestoreError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.clients && !json.deployments) {
          throw new Error("File does not appear to be a valid Reflection Solutions backup JSON.");
        }
        setRestorePreview(json);
      } catch (err: any) {
        setRestoreError(err.message || "Invalid JSON file.");
        setRestorePreview(null);
      }
    };
    reader.readAsText(file);
  };

  // 3. Confirm Restore
  const handleConfirmRestore = async () => {
    if (!restorePreview) return;
    setRestoring(true);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: restorePreview }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Restore failed");
      }

      showToast("success", data.message || "System restored successfully from backup.");
      setRestoreFile(null);
      setRestorePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      triggerRefresh();
      fetchStats();
    } catch (err: any) {
      showToast("error", err.message || "Error restoring backup.");
    } finally {
      setRestoring(false);
    }
  };

  // 4. Handle Clear / Reset
  const handleExecuteClear = async () => {
    if (!confirmModalMode || confirmText.trim().toUpperCase() !== "CONFIRM") {
      showToast("error", "Please type 'CONFIRM' to execute this action.");
      return;
    }

    setClearing(true);
    try {
      const res = await fetch("/api/maintenance/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: confirmModalMode,
          confirmation: "CONFIRM",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Operation failed");
      }

      showToast("success", data.message);
      setConfirmModalMode(null);
      setConfirmText("");
      triggerRefresh();
      fetchStats();
    } catch (err: any) {
      showToast("error", err.message || "Operation failed.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 mb-1">
            <Database size={14} />
            <span>SYSTEM MAINTENANCE & DATA OPERATIONS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Backup & Data Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Export full system snapshots, restore data from JSON archives, or reset/purge the database
          </p>
        </div>

        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 transition-all self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loadingMetrics ? "animate-spin" : ""} />
          <span>Refresh Footprint</span>
        </button>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-xs border ${
            feedback.type === "success"
              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
              : "bg-rose-500/10 text-rose-300 border-rose-500/30"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle size={16} className="text-rose-400 shrink-0" />
          )}
          <span className="font-medium">{feedback.text}</span>
        </div>
      )}

      {/* Live System Footprint Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 glass-panel">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 size={13} className="text-emerald-400" />
            <span>Clients</span>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono mt-1">
            {metrics?.total_clients ?? "..."}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 glass-panel">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers size={13} className="text-indigo-400" />
            <span>Deployments</span>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono mt-1">
            {metrics?.total_deployments ?? "..."}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 glass-panel">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Server size={13} className="text-sky-400" />
            <span>Infra Nodes</span>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono mt-1">
            {metrics?.active_servers ?? "..."}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 glass-panel">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-amber-400" />
            <span>Active Licenses</span>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono mt-1">
            {metrics ? metrics.total_deployments - metrics.expired_licenses : "..."}
          </div>
        </div>
      </div>

      {/* Grid: 1. Backup & 2. Restore */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Full System Backup */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 glass-panel flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Download size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Export Complete Backup</h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Generates a JSON snapshot containing all clients, deployed software solutions, servers, encrypted credentials vault, and the audit trail.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-300 space-y-1">
              <div className="flex items-center gap-2 text-indigo-300 font-medium">
                <CheckCircle2 size={13} />
                <span>AES-256-GCM Vault Integrity Preserved</span>
              </div>
              <p className="text-slate-400">
                Encrypted secrets remain securely hashed & ciphered in the export archive.
              </p>
            </div>
          </div>

          <button
            onClick={handleDownloadBackup}
            disabled={downloadingBackup}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/25 transition-all disabled:opacity-50"
          >
            <Download size={15} />
            <span>{downloadingBackup ? "Generating Backup..." : "Download JSON Backup"}</span>
          </button>
        </div>

        {/* Card 2: Restore from Backup */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 glass-panel flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <UploadCloud size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Restore from Backup</h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Upload a Reflection Solutions JSON backup file to restore records. This replaces existing database records with the archive contents.
              </p>
            </div>

            {/* File Input */}
            <div className="mt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
                id="backup-file-upload"
              />
              <label
                htmlFor="backup-file-upload"
                className="cursor-pointer block border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/50 hover:bg-slate-950 p-4 rounded-xl text-center transition-all"
              >
                <FileCode size={24} className="mx-auto text-slate-500 mb-1" />
                <span className="text-xs text-slate-300 font-medium block">
                  {restoreFile ? restoreFile.name : "Click to select a .json backup file"}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {restoreFile ? `${(restoreFile.size / 1024).toFixed(1)} KB` : "Supports Reflection Solutions exported JSON"}
                </span>
              </label>
            </div>

            {restoreError && (
              <div className="text-[11px] text-rose-400 flex items-center gap-1.5">
                <AlertTriangle size={13} />
                <span>{restoreError}</span>
              </div>
            )}

            {restorePreview && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] space-y-1">
                <div className="font-semibold text-sky-300">Archive Ready to Restore:</div>
                <div className="grid grid-cols-3 gap-2 text-slate-300 font-mono text-[10px] pt-1">
                  <div>Clients: {restorePreview.clients?.length || 0}</div>
                  <div>Deployments: {restorePreview.deployments?.length || 0}</div>
                  <div>Servers: {restorePreview.servers?.length || 0}</div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleConfirmRestore}
            disabled={!restorePreview || restoring}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-md shadow-sky-600/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <UploadCloud size={15} />
            <span>{restoring ? "Restoring System..." : "Restore Selected Backup"}</span>
          </button>
        </div>
      </div>

      {/* Danger Zone: Clear Data & Factory Reset */}
      <div className="p-6 rounded-2xl bg-rose-950/10 border border-rose-900/30 glass-panel space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-rose-200">Database Purge & Reset Zone</h2>
            <p className="text-xs text-rose-300/70 mt-0.5">
              Irreversible maintenance operations. Please ensure you have downloaded a backup before proceeding.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Action A: Reset to Sample Demo Data */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-xs text-slate-200">
                <RotateCcw size={14} className="text-amber-400" />
                <span>Reset to Sample Demo Records</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Clears any custom clients/deployments created and restores the default agency demo dataset (Acme Corp, Apex Retail, etc.).
              </p>
            </div>
            <button
              onClick={() => {
                setConfirmModalMode("reset_seed");
                setConfirmText("");
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-semibold transition-colors"
            >
              <RotateCcw size={13} />
              <span>Reset to Sample Data</span>
            </button>
          </div>

          {/* Action B: Complete Data Purge */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-rose-900/30 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-xs text-rose-300">
                <Trash2 size={14} className="text-rose-400" />
                <span>Purge All Records (Empty System)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Wipes all clients, deployments, servers, solutions catalog, and vault credentials. The system will start from a 100% clean, blank state.
              </p>
            </div>
            <button
              onClick={() => {
                setConfirmModalMode("clear_all");
                setConfirmText("");
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/20 transition-all"
            >
              <Trash2 size={13} />
              <span>Purge All Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal Safeguard */}
      {confirmModalMode && (
        <ModalShell
          onClose={() => {
            setConfirmModalMode(null);
            setConfirmText("");
          }}
          busy={clearing}
          size="sm"
        >
          <div className="overflow-y-auto overscroll-contain min-h-0 p-5 sm:p-7 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-7 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-base font-bold text-white">
                {confirmModalMode === "reset_seed" ? "Confirm Sample Data Reset" : "Confirm Complete Data Purge"}
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {confirmModalMode === "reset_seed"
                ? "This will replace all current clients, servers, and deployments with initial demo seed data."
                : "This will permanently delete ALL clients, servers, deployments, solutions catalog, and vault credentials. This action CANNOT be undone without a backup file."}
            </p>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
              <label className="text-slate-400 block text-[11px]">
                To proceed, type <span className="font-mono text-rose-400 font-bold">CONFIRM</span> below:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="CONFIRM"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setConfirmModalMode(null);
                  setConfirmText("");
                }}
                disabled={clearing}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteClear}
                disabled={confirmText.trim().toUpperCase() !== "CONFIRM" || clearing}
                className={`w-full sm:w-auto px-5 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-md ${
                  confirmModalMode === "reset_seed"
                    ? "bg-amber-600 hover:bg-amber-500 disabled:opacity-40"
                    : "bg-rose-600 hover:bg-rose-500 disabled:opacity-40"
                }`}
              >
                {clearing ? "Processing..." : confirmModalMode === "reset_seed" ? "Reset to Demo Seed" : "Execute Purge"}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
