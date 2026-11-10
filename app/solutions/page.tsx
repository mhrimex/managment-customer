"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Boxes,
  Layers,
  ArrowUpRight,
  ShoppingBag,
  Smartphone,
  Database,
  Globe,
  FileCode,
  PlusCircle,
  Edit3,
  Trash2,
} from "lucide-react";
import { Solution } from "@/types";
import { SkeletonCards } from "@/components/Skeleton";
import { useApp } from "@/components/AppLayoutClient";
import { useFeedback } from "@/components/Feedback";
import { useSafeDelete } from "@/components/useSafeDelete";
import SolutionModal, { CATEGORY_OPTIONS } from "@/components/SolutionModal";

const categoryLabel = (c: string) => CATEGORY_OPTIONS.find((o) => o.value === c)?.label || c;

export default function SolutionsPage() {
  const { refreshTrigger, triggerRefresh } = useApp();
  const { toast } = useFeedback();
  const safeDelete = useSafeDelete();
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Solution | null>(null);

  const fetchSolutions = useCallback(() => {
    setLoading(true);
    fetch("/api/solutions")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setSolutions(data.data);
        else toast(data.error || "Failed to load solutions", "error");
      })
      .catch(() => toast("Could not load solutions", "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    fetchSolutions();
  }, [fetchSolutions, refreshTrigger]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (sol: Solution) => {
    setEditing(sol);
    setModalOpen(true);
  };

  const handleDelete = async (sol: Solution) => {
    const deleted = await safeDelete({
      kind: "solution",
      id: sol.id,
      title: `Delete ${sol.name}?`,
      message: "The solution will be removed from the catalog.",
      confirmLabel: "Delete solution",
    });
    if (!deleted) return;
    toast(`${sol.name} was deleted.`);
    fetchSolutions();
    triggerRefresh();
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "ERP":
        return <Database size={24} className="text-indigo-400" />;
      case "POS":
        return <ShoppingBag size={24} className="text-emerald-400" />;
      case "MOBILE_APP":
        return <Smartphone size={24} className="text-sky-400" />;
      case "E_COMMERCE":
        return <Globe size={24} className="text-amber-400" />;
      case "CUSTOM_SOFTWARE":
        return <FileCode size={24} className="text-purple-400" />;
      default:
        return <Boxes size={24} className="text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-amber-400 mb-2">
            <Boxes size={16} />
            <span>Agency Software Portfolio</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Solutions Catalog</h1>
          <p className="text-base text-slate-400 mt-2">
            Software packages, modules and custom solutions you deploy to clients
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/deployments"
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 transition-all"
          >
            <Layers size={18} className="text-indigo-400" />
            <span>Deployments</span>
          </Link>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold shadow-md shadow-amber-600/20 transition-all"
          >
            <PlusCircle size={18} />
            <span>Add Solution</span>
          </button>
        </div>
      </div>

      {/* Solutions Grid */}
      {loading && solutions.length === 0 ? (
        <SkeletonCards count={6} />
      ) : solutions.length === 0 ? (
        <div className="py-20 text-center rounded-2xl border-2 border-dashed border-slate-800">
          <Boxes size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-lg font-bold text-slate-200">No solutions yet</p>
          <p className="text-sm text-slate-400 mt-1 mb-6">
            Add the software products you sell. You need at least one before you can create a deployment.
          </p>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold transition-all"
          >
            <PlusCircle size={18} />
            Add your first solution
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {solutions.map((sol) => (
            <div
              key={sol.id}
              className="rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 hover:-translate-y-0.5 hover:shadow-xl transition-all p-6 glass-panel flex flex-col justify-between space-y-5"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    {getCategoryIcon(sol.category)}
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                    {sol.deployments_count || 0} deployment{(sol.deployments_count || 0) === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-5">
                  <h3 className="font-display font-bold text-lg text-slate-100">{sol.name}</h3>
                  <div className="text-sm font-semibold text-amber-400 mt-0.5">{categoryLabel(sol.category)}</div>
                  {sol.description && (
                    <p className="text-sm text-slate-400 mt-3 leading-relaxed line-clamp-4">{sol.description}</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-sm">
                <Link
                  href={`/deployments?category=${sol.category}`}
                  className="font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <span>View deployments</span>
                  <ArrowUpRight size={16} />
                </Link>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(sol)}
                    className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                    title="Edit solution"
                    aria-label={`Edit ${sol.name}`}
                  >
                    <Edit3 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(sol)}
                    className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                    title="Delete solution"
                    aria-label={`Delete ${sol.name}`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <SolutionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          fetchSolutions();
          triggerRefresh();
        }}
        solutionToEdit={editing}
      />
    </div>
  );
}
