"use client";

import React, { useState } from "react";
import ModalShell, { ModalCloseButton } from "@/components/ModalShell";
import { Save, AlertCircle, Server as ServerIcon } from "lucide-react";
import { Server, ServerType } from "@/types";

interface ServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (server?: Server) => void;
}

export default function ServerModal({
  isOpen,
  onClose,
  onSuccess,
}: ServerModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [serverName, setServerName] = useState("");
  const [provider, setProvider] = useState("AWS");
  const [ipAddress, setIpAddress] = useState("");
  const [serverType, setServerType] = useState<ServerType>("CLOUD_VPS");
  const [loginNotes, setLoginNotes] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverName.trim() || !ipAddress.trim()) {
      setError("Server name and IP address are required.");
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      server_name: serverName.trim(),
      provider: provider.trim(),
      ip_address: ipAddress.trim(),
      server_type: serverType,
      login_notes: loginNotes.trim() || null,
    };

    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create server");
      }

      onSuccess(data.data);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} busy={loading} size="md">
        <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-3.5 sm:py-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
              <ServerIcon size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Add Infrastructure Server</h3>
              <p className="text-xs text-slate-400">Register cloud host or on-premise hardware node</p>
            </div>
          </div>
          <ModalCloseButton onClick={onClose} disabled={loading} />
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto overscroll-contain min-h-0 flex-1 px-5 sm:px-7 pt-5 sm:pt-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Server Hostname / Identifier <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="e.g. AWS-Frankfurt-Prod-02"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Provider
              </label>
              <input
                type="text"
                required
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="AWS, Hetzner, DigitalOcean, Local..."
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                IP Address / Hostname <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="54.210.142.88"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Server Type
            </label>
            <select
              value={serverType}
              onChange={(e) => setServerType(e.target.value as ServerType)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              <option value="CLOUD_VPS">CLOUD_VPS (Virtual Private Server)</option>
              <option value="DEDICATED">DEDICATED (Bare-metal server)</option>
              <option value="SHARED">SHARED (Shared cluster node)</option>
              <option value="ON_PREMISE">ON_PREMISE (Customer local hardware)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Access & Bastion Login Notes
            </label>
            <textarea
              rows={3}
              value={loginNotes}
              onChange={(e) => setLoginNotes(e.target.value)}
              placeholder="SSH port, bastion host IP, VPN credentials or key filename..."
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono text-[11px]"
            />
          </div>

          <div className="sticky bottom-0 z-10 -mx-5 sm:-mx-7 px-5 sm:px-7 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6 bg-slate-900 border-t border-slate-800 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold shadow-md shadow-sky-600/20 transition-all disabled:opacity-50"
            >
              <Save size={18} />
              <span>{loading ? "Registering..." : "Add Server"}</span>
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
