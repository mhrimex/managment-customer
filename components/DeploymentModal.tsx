"use client";

import React, { useState, useEffect, useRef } from "react";
import ModalShell, { ModalCloseButton } from "@/components/ModalShell";
import { Save, AlertCircle } from "lucide-react";
import {
  ClientDeployment,
  Client,
  Solution,
  Server,
  DeploymentStatus,
  DeploymentEnvironment,
  LicenseType,
  SupportContractStatus
} from "@/types";

interface DeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  deploymentToEdit?: ClientDeployment | null;
  defaultClientId?: string;
}

export default function DeploymentModal({
  isOpen,
  onClose,
  onSuccess,
  deploymentToEdit,
  defaultClientId,
}: DeploymentModalProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [clientId, setClientId] = useState(defaultClientId || "");
  const [solutionId, setSolutionId] = useState("");
  const [serverId, setServerId] = useState("");
  const [instanceUrl, setInstanceUrl] = useState("");
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>("ACTIVE");
  const [environment, setEnvironment] = useState<DeploymentEnvironment>("PRODUCTION");
  const [databaseName, setDatabaseName] = useState("");
  const [versionInstalled, setVersionInstalled] = useState("v1.0.0");
  const [licenseType, setLicenseType] = useState<LicenseType>("ANNUAL_LICENSE");
  const [renewalDate, setRenewalDate] = useState("");
  const [supportContractStatus, setSupportContractStatus] = useState<SupportContractStatus>("ACTIVE");
  const [notes, setNotes] = useState("");

  // The Save button is at the bottom of a long form: bring a refusal into view
  const errorBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorBox.current?.scrollIntoView({ block: "nearest" });
  }, [error]);

  // Load select options
  useEffect(() => {
    if (!isOpen) return;

    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/solutions").then((r) => r.json()),
      fetch("/api/servers").then((r) => r.json()),
    ])
      .then(([clientsRes, solutionsRes, serversRes]) => {
        if (clientsRes.success) setClients(clientsRes.data);
        if (solutionsRes.success) setSolutions(solutionsRes.data);
        if (serversRes.success) setServers(serversRes.data);
      })
      .catch((err) => console.error("Error loading options:", err));
  }, [isOpen]);

  // Populate form if editing
  useEffect(() => {
    if (deploymentToEdit) {
      setClientId(deploymentToEdit.client_id || "");
      setSolutionId(deploymentToEdit.solution_id || "");
      setServerId(deploymentToEdit.server_id || "");
      setInstanceUrl(deploymentToEdit.instance_url || "");
      setDeploymentStatus(deploymentToEdit.deployment_status);
      setEnvironment(deploymentToEdit.environment);
      setDatabaseName(deploymentToEdit.database_name || "");
      setVersionInstalled(deploymentToEdit.version_installed || "v1.0.0");
      setLicenseType(deploymentToEdit.license_type);
      setRenewalDate(deploymentToEdit.renewal_date || "");
      setSupportContractStatus(deploymentToEdit.support_contract_status);
      setNotes(deploymentToEdit.notes || "");
    } else {
      setClientId(defaultClientId || "");
      setSolutionId("");
      setServerId("");
      setInstanceUrl("");
      setDeploymentStatus("ACTIVE");
      setEnvironment("PRODUCTION");
      setDatabaseName("");
      setVersionInstalled("v1.0.0");
      setLicenseType("ANNUAL_LICENSE");
      setRenewalDate("");
      setSupportContractStatus("ACTIVE");
      setNotes("");
    }
    setError(null);
  }, [deploymentToEdit, defaultClientId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setError("Please select a client.");
      return;
    }
    if (!solutionId) {
      setError("Please select a software solution.");
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      client_id: clientId,
      solution_id: solutionId,
      server_id: serverId ? serverId : null,
      instance_url: instanceUrl.trim() || null,
      deployment_status: deploymentStatus,
      environment,
      database_name: databaseName.trim() || null,
      version_installed: versionInstalled.trim() || null,
      license_type: licenseType,
      renewal_date: renewalDate ? renewalDate : null,
      support_contract_status: supportContractStatus,
      notes: notes.trim() || null,
    };

    try {
      const url = deploymentToEdit
        ? `/api/deployments/${deploymentToEdit.id}`
        : "/api/deployments";
      const method = deploymentToEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save deployment");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} busy={loading} size="xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-3.5 sm:py-5 border-b border-slate-800 shrink-0">
          <div>
            <h3 className="text-base font-bold text-white">
              {deploymentToEdit ? "Edit Deployment Specifications" : "Deploy Solution to Client"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Link software solution, hosting infrastructure, license renewals & environment
            </p>
          </div>
          <ModalCloseButton onClick={onClose} disabled={loading} />
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto overscroll-contain min-h-0 flex-1 px-5 sm:px-7 pt-5 sm:pt-6 space-y-5">
          {error && (
            <div ref={errorBox} className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Client & Solution row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Client <span className="text-rose-400">*</span>
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">Select a Client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name} ({c.contact_person || "No contact"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Software Solution <span className="text-rose-400">*</span>
              </label>
              <select
                value={solutionId}
                onChange={(e) => setSolutionId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">Select a Solution</option>
                {solutions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
              {solutions.length === 0 && (
                <p className="text-sm text-amber-400 mt-2">
                  No solutions yet.{" "}
                  <a href="/solutions" className="underline font-semibold hover:text-amber-300">
                    Add one in the Solutions Catalog
                  </a>
                  .
                </p>
              )}
            </div>
          </div>
          {clients.length === 0 && (
            <p className="text-sm text-amber-400 -mt-2">
              No clients yet.{" "}
              <a href="/clients" className="underline font-semibold hover:text-amber-300">
                Register a client first
              </a>
              .
            </p>
          )}

          {/* Server & Instance URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Hosting Server
              </label>
              <select
                value={serverId}
                onChange={(e) => setServerId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">None / External Cloud SaaS</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.server_name} ({s.provider} - {s.ip_address})
                  </option>
                ))}
              </select>
              {!serverId && (
                <p className="text-xs text-amber-400 mt-1.5">
                  With no server, employees can&apos;t be given access to this deployment.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Domain / Instance URL
              </label>
              <input
                type="text"
                value={instanceUrl}
                onChange={(e) => setInstanceUrl(e.target.value)}
                placeholder="e.g. erp.clientdomain.com"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Status & Environment */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Deployment Status
              </label>
              <select
                value={deploymentStatus}
                onChange={(e) => setDeploymentStatus(e.target.value as DeploymentStatus)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="DECOMMISSIONED">DECOMMISSIONED</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Environment
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as DeploymentEnvironment)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="PRODUCTION">PRODUCTION</option>
                <option value="STAGING">STAGING</option>
                <option value="TEST">TEST</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Installed Version
              </label>
              <input
                type="text"
                value={versionInstalled}
                onChange={(e) => setVersionInstalled(e.target.value)}
                placeholder="v1.0.0"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Database & License Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Database Name
              </label>
              <input
                type="text"
                value={databaseName}
                onChange={(e) => setDatabaseName(e.target.value)}
                placeholder="e.g. client_erp_prod"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                License Model
              </label>
              <select
                value={licenseType}
                onChange={(e) => setLicenseType(e.target.value as LicenseType)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="ANNUAL_LICENSE">ANNUAL_LICENSE</option>
                <option value="MONTHLY_SUBSCRIPTION">MONTHLY_SUBSCRIPTION</option>
                <option value="ONE_TIME_PERPETUAL">ONE_TIME_PERPETUAL</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Renewal Date
              </label>
              <input
                type="date"
                value={renewalDate}
                onChange={(e) => setRenewalDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Support contract & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Support Contract Status
              </label>
              <select
                value={supportContractStatus}
                onChange={(e) => setSupportContractStatus(e.target.value as SupportContractStatus)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="NO_CONTRACT">NO_CONTRACT</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Notes / Maintenance Instructions
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Backup schedule, custom integrations, VPN notes..."
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Action buttons */}
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
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              <Save size={18} />
              <span>{loading ? "Saving..." : deploymentToEdit ? "Update Deployment" : "Deploy Solution"}</span>
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
