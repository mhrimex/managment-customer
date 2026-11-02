"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Save, AlertCircle, Building2, ImagePlus, Trash2 } from "lucide-react";
import { Client } from "@/types";
import CompanyAvatar from "@/components/CompanyAvatar";
import { useFeedback } from "@/components/Feedback";

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (client?: Client) => void;
  clientToEdit?: Client | null;
}

const LOGO_SIZE = 256;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Downscale an image file to fit LOGO_SIZE×LOGO_SIZE and return a compact data URL. */
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, LOGO_SIZE / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Your browser cannot process images."));
        return;
      }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      // WebP keeps transparency and is small; browsers without WebP encoding fall back to PNG
      resolve(canvas.toDataURL("image/webp", 0.9));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as an image."));
    };
    img.src = url;
  });
}

const inputCls =
  "w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-base focus:ring-2 focus:ring-emerald-500 focus:outline-none";
const labelCls = "block text-sm font-semibold text-slate-300 mb-2";

export default function ClientModal({
  isOpen,
  onClose,
  onSuccess,
  clientToEdit,
}: ClientModalProps) {
  const { toast } = useFeedback();
  const fileInput = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phonePrimary, setPhonePrimary] = useState("");
  const [phoneSecondary, setPhoneSecondary] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [logoChanged, setLogoChanged] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (clientToEdit) {
      setCompanyName(clientToEdit.company_name || "");
      setContactPerson(clientToEdit.contact_person || "");
      setEmail(clientToEdit.email || "");
      setPhonePrimary(clientToEdit.phone_primary || "");
      setPhoneSecondary(clientToEdit.phone_secondary || "");
      setAddress(clientToEdit.address || "");
      setNotes(clientToEdit.notes || "");
      setLogo(clientToEdit.logo_url || null);
    } else {
      setCompanyName("");
      setContactPerson("");
      setEmail("");
      setPhonePrimary("");
      setPhoneSecondary("");
      setAddress("");
      setNotes("");
      setLogo(null);
    }
    setLogoChanged(false);
    setError(null);
  }, [clientToEdit, isOpen]);

  // Escape closes the dialog
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG, JPG, WebP or SVG).");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("That image is larger than 5 MB. Please choose a smaller file.");
      return;
    }
    try {
      const dataUrl = await resizeImage(file);
      setLogo(dataUrl);
      setLogoChanged(true);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Could not process that image.");
    }
  };

  const handleRemoveLogo = () => {
    setLogo(null);
    setLogoChanged(true);
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError("Company Name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    const payload: Record<string, unknown> = {
      company_name: companyName.trim(),
      contact_person: contactPerson.trim() || null,
      email: email.trim() || null,
      phone_primary: phonePrimary.trim() || null,
      phone_secondary: phoneSecondary.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    };
    // Only send the logo when it changed: data URL = new logo, "" = remove
    if (logoChanged) payload.logo_url = logo || "";

    try {
      const url = clientToEdit ? `/api/clients/${clientToEdit.id}` : "/api/clients";
      const method = clientToEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save client");
      }

      toast(clientToEdit ? `${payload.company_name} was updated.` : `${payload.company_name} was registered.`);
      onSuccess(data.data);
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => !loading && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-modal-title"
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden glass-panel flex flex-col max-h-[92vh] animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Building2 size={22} />
            </div>
            <div>
              <h3 id="client-modal-title" className="text-xl font-bold text-white">
                {clientToEdit ? "Edit Client Profile" : "Register New Client"}
              </h3>
              <p className="text-sm text-slate-400">Logo, contacts and SLA notes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-7 space-y-5 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2.5">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Company logo */}
          <div>
            <span className={labelCls}>Company Logo</span>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
              className={`flex items-center gap-5 p-4 rounded-2xl border-2 border-dashed transition-colors ${
                dragOver ? "border-emerald-500 bg-emerald-500/5" : "border-slate-700"
              }`}
            >
              <CompanyAvatar name={companyName || "New Client"} logoUrl={logo} size="xl" />
              <div className="flex-1 min-w-0 space-y-2.5">
                <p className="text-sm text-slate-400">
                  Drag an image here or choose a file. PNG, JPG, WebP or SVG, up to 5 MB. It&apos;s resized to
                  256&nbsp;px automatically.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold transition-colors"
                  >
                    <ImagePlus size={18} className="text-emerald-400" />
                    {logo ? "Replace logo" : "Upload logo"}
                  </button>
                  {logo && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-rose-300 hover:bg-rose-500/10 text-sm font-semibold transition-colors"
                    >
                      <Trash2 size={17} />
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>
              Company Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Logistics Global"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Primary Contact Person</label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. Sarah Jenkins"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Official Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@company.com"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Primary Phone (WhatsApp / Calls)</label>
              <input
                type="text"
                value={phonePrimary}
                onChange={(e) => setPhonePrimary(e.target.value)}
                placeholder="+1-555-019-2834"
                className={`${inputCls} font-mono`}
              />
            </div>

            <div>
              <label className={labelCls}>Secondary Phone</label>
              <input
                type="text"
                value={phoneSecondary}
                onChange={(e) => setPhoneSecondary(e.target.value)}
                placeholder="+1-555-019-9988"
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Physical / Billing Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="1400 Broadway, New York, NY 10018"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Account Notes / SLA Agreement</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enterprise SLA agreement, dedicated escalation channels, timezone..."
              className={inputCls}
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-5 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              <Save size={18} />
              <span>{loading ? "Saving..." : clientToEdit ? "Update Client" : "Create Client"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
