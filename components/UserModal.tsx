"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  Save, 
  AlertCircle, 
  User as UserIcon, 
  Mail, 
  Lock, 
  ShieldCheck, 
  UserCheck, 
  KeyRound,
  Eye,
  EyeOff
} from "lucide-react";
import { User, UserRole } from "@/types";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user?: User) => void;
  userToEdit?: User | null;
}

export default function UserModal({
  isOpen,
  onClose,
  onSuccess,
  userToEdit,
}: UserModalProps) {
  const isEditing = Boolean(userToEdit);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("SUPPORT_ENGINEER");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userToEdit) {
      setName(userToEdit.name || "");
      setEmail(userToEdit.email || "");
      setRole(userToEdit.role || "SUPPORT_ENGINEER");
      setPassword("");
    } else {
      setName("");
      setEmail("");
      setRole("SUPPORT_ENGINEER");
      setPassword("");
    }
    setError(null);
    setShowPassword(false);
  }, [userToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Staff name is required.");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setError("Please provide a valid email address.");
      return;
    }

    if (!isEditing && (!password || password.length < 6)) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (isEditing && password && password.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    setError(null);

    const payload: any = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
    };

    if (password.trim()) {
      payload.password = password.trim();
    }

    try {
      const endpoint = isEditing ? `/api/users/${userToEdit!.id}` : "/api/users";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save user account");
      }

      onSuccess(data.data);
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden glass-panel flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
              {role === "ADMIN" ? <ShieldCheck size={20} /> : <UserCheck size={20} />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isEditing ? "Edit Staff Account" : "Add New Staff Member"}
              </h3>
              <p className="text-xs text-slate-400">
                {isEditing
                  ? `Update permissions and credentials for ${userToEdit?.name}`
                  : "Provision a new administrator or support engineer account"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Full Name *
            </label>
            <div className="relative">
              <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Elena Rostova"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Staff Email Address *
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@agency.com"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Access Role & Privileges *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("ADMIN")}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  role === "ADMIN"
                    ? "bg-indigo-600/15 border-indigo-500/50 text-white"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-indigo-300">
                  <ShieldCheck size={16} />
                  <span>Administrator</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Full system access: manage team, infrastructure, clients, and audits.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRole("SUPPORT_ENGINEER")}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  role === "SUPPORT_ENGINEER"
                    ? "bg-emerald-600/15 border-emerald-500/50 text-white"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-300">
                  <UserCheck size={16} />
                  <span>Support Engineer</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Operational access: view deployments, servers, and inspect vault credentials.
                </p>
              </button>
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {isEditing ? "Reset Password (leave blank to keep current)" : "Initial Password *"}
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                required={!isEditing}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEditing ? "••••••••••••" : "Minimum 6 characters"}
                className="w-full pl-9 pr-10 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Hashed securely using PBKDF2 with SHA-512 and unique cryptographic salts.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Save size={14} />
              <span>{loading ? "Saving Account..." : isEditing ? "Save Changes" : "Create Account"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

