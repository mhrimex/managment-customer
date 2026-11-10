"use client";

import { useRevealError } from "@/components/useRevealError";
import React, { useEffect, useState } from "react";
import ModalShell, { ModalCloseButton } from "@/components/ModalShell";
import { AlertCircle, Boxes, Save, X } from "lucide-react";
import { Solution, SolutionCategory } from "@/types";
import { useFeedback } from "@/components/Feedback";

export const CATEGORY_OPTIONS: { value: SolutionCategory; label: string }[] = [
  { value: "ERP", label: "ERP" },
  { value: "POS", label: "Point of Sale (POS)" },
  { value: "MOBILE_APP", label: "Mobile App" },
  { value: "CUSTOM_SOFTWARE", label: "Custom Software" },
  { value: "E_COMMERCE", label: "E-Commerce" },
  { value: "OTHER", label: "Other" },
];

interface SolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  solutionToEdit?: Solution | null;
}

const inputCls =
  "w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-base focus:ring-2 focus:ring-amber-500 focus:outline-none";
const labelCls = "block text-sm font-semibold text-slate-300 mb-2";

export default function SolutionModal({ isOpen, onClose, onSaved, solutionToEdit }: SolutionModalProps) {
  const { toast } = useFeedback();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<SolutionCategory>("CUSTOM_SOFTWARE");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRevealError(error);

  useEffect(() => {
    setName(solutionToEdit?.name || "");
    setCategory(solutionToEdit?.category || "CUSTOM_SOFTWARE");
    setDescription(solutionToEdit?.description || "");
    setError(null);
  }, [solutionToEdit, isOpen]);


  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Solution name is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(solutionToEdit ? `/api/solutions/${solutionToEdit.id}` : "/api/solutions", {
        method: solutionToEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), category, description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to save solution");
      toast(solutionToEdit ? `${name.trim()} was updated.` : `${name.trim()} was added to the catalog.`);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} busy={loading} size="lg" labelledBy="solution-modal-title">
        <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-3.5 sm:py-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
              <Boxes size={22} />
            </div>
            <div>
              <h3 id="solution-modal-title" className="text-xl font-bold text-white">
                {solutionToEdit ? "Edit Solution" : "Add Solution"}
              </h3>
              <p className="text-sm text-slate-400">A software product you deploy to clients</p>
            </div>
          </div>
          <ModalCloseButton onClick={onClose} disabled={loading} />
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto overscroll-contain min-h-0 flex-1 px-5 sm:px-7 pt-5 sm:pt-6 space-y-5">
          {error && (
            <div ref={errorRef} className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2.5">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className={labelCls}>
              Solution Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              maxLength={255}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. OmniCore ERP Suite"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SolutionCategory)}
              className={inputCls}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Modules, features and what this product does..."
              className={inputCls}
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
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold shadow-md shadow-amber-600/20 transition-all disabled:opacity-50"
            >
              <Save size={18} />
              <span>{loading ? "Saving..." : solutionToEdit ? "Save Changes" : "Add Solution"}</span>
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
