"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  Search,
  PlusCircle,
  Phone,
  Mail,
  MessageSquare,
  ArrowUpRight,
  Trash2,
  Edit3,
  Layers,
  MapPin,
  RefreshCw,
  Users
} from "lucide-react";
import { Client } from "@/types";
import { useApp } from "@/components/AppLayoutClient";
import CopyButton from "@/components/CopyButton";
import CompanyAvatar from "@/components/CompanyAvatar";
import { useFeedback } from "@/components/Feedback";
import { SkeletonCards } from "@/components/Skeleton";
import { formatDate } from "@/lib/utils";

export default function ClientsPage() {
  const { openNewClient, openEditClient, refreshTrigger, triggerRefresh } = useApp();
  const { toast, confirm } = useFeedback();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients?search=${encodeURIComponent(search.trim())}`);
      const data = await res.json();
      if (data.success) {
        setClients(data.data);
      }
    } catch (err) {
      console.error("Failed to load clients:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [refreshTrigger]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClients();
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Delete ${name}?`,
      message: "This permanently removes the client and all of its deployments and vault credentials. This cannot be undone.",
      confirmLabel: "Delete client",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast(`${name} was deleted.`);
        triggerRefresh();
        fetchClients();
      } else {
        toast(data.error || "Failed to delete client", "error");
      }
    } catch {
      toast("Error deleting client", "error");
    }
  };

  const cleanPhone = (phone?: string | null) => {
    if (!phone) return "";
    return phone.replace(/[^0-9]/g, "");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-emerald-400 mb-2">
            <Users size={16} />
            <span>CLIENT MANAGEMENT CENTER</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Client Directory
          </h1>
          <p className="text-base text-slate-400 mt-2">
            Maintain customer records, contact numbers, and SLA contract agreements
          </p>
        </div>

        <button
          onClick={() => openNewClient()}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-md shadow-emerald-600/25 transition-all self-start sm:self-auto"
        >
          <PlusCircle size={18} />
          <span>Register New Client</span>
        </button>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients by company name, contact person, email, or phone..."
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-base placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
        <button
          onClick={() => fetchClients()}
          className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700/80 flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Clients Cards Grid */}
      {loading && clients.length === 0 ? (
        <SkeletonCards count={6} />
      ) : clients.length === 0 ? (
        <div className="py-20 text-center text-xs text-slate-400">
          <Building2 size={32} className="mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-medium text-slate-300">No clients found</p>
          <p className="text-slate-500 mt-1">Try adjusting your search criteria or register a new client.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {clients.map((client) => (
            <div
              key={client.id}
              className="rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 hover:-translate-y-0.5 hover:shadow-xl transition-all p-6 glass-panel flex flex-col justify-between space-y-4 group"
            >
              <div>
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1 basis-[13rem]">
                    <CompanyAvatar name={client.company_name} logoUrl={client.logo_url} size="lg" />
                    <div className="min-w-0">
                      <Link
                        href={`/clients/${client.id}`}
                        className="font-display font-bold text-lg text-slate-100 group-hover:text-emerald-400 transition-colors line-clamp-1"
                      >
                        {client.company_name}
                      </Link>
                      <div className="text-sm text-slate-400 mt-0.5">
                        {client.contact_person || "Contact unassigned"}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                    <Layers size={11} />
                    {client.deployments_count || 0} systems
                  </span>
                </div>

                {/* Contact list */}
                <div className="mt-5 space-y-2.5 text-sm">
                  {client.email && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Mail size={16} className="text-slate-500 shrink-0" />
                      <a href={`mailto:${client.email}`} className="truncate hover:underline text-slate-300">
                        {client.email}
                      </a>
                    </div>
                  )}

                  {client.phone_primary && (
                    <div className="flex items-center justify-between text-slate-300">
                      <div className="flex items-center gap-2 font-mono">
                        <Phone size={16} className="text-slate-500 shrink-0" />
                        <span>{client.phone_primary}</span>
                        <CopyButton text={client.phone_primary} />
                      </div>

                      {/* WhatsApp shortcut button */}
                      <a
                        href={`https://wa.me/${cleanPhone(client.phone_primary)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 px-2 rounded bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                        title="Chat on WhatsApp"
                      >
                        <MessageSquare size={11} />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  )}

                  {client.address && (
                    <div className="flex items-start gap-2 text-slate-400 text-[11px] pt-1">
                      <MapPin size={16} className="text-slate-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{client.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-sm">
                <Link
                  href={`/clients/${client.id}`}
                  className="font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  <span>View Details</span>
                  <ArrowUpRight size={13} />
                </Link>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditClient(client)}
                    className="p-2 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                    title="Edit Client"
                  >
                    <Edit3 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(client.id, client.company_name)}
                    className="p-2 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                    title="Delete Client"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
