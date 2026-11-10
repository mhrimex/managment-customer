"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { useRevealError } from "@/components/useRevealError";

const inputCls =
  "w-full px-4 py-3.5 pr-11 rounded-xl bg-slate-950 border border-slate-800 text-white text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none";

/** Shown instead of everything else after signing in with a default password; also reachable from the side menu. */
export default function ChangePasswordPage() {
  const [forced, setForced] = useState(false);
  const [name, setName] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRevealError(error);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setForced(d.user?.must_change_password === true);
        setName(d.user?.name || "");
      })
      .catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== repeat) return setError("The two new passwords are not the same.");
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || "Failed to change the password");
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Failed to change the password");
      setSaving(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, autoComplete: string) => (
    <div>
      <label className="block text-base font-semibold text-slate-200 mb-2">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          required
          value={value}
          onChange={(e) => set(e.target.value)}
          autoComplete={autoComplete}
          className={inputCls}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
          aria-label={show ? "Hide passwords" : "Show passwords"}
          tabIndex={-1}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-lg space-y-6">
        {!forced && (
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
            <ArrowLeft size={16} /> Back
          </Link>
        )}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-7 sm:p-10 glass-panel shadow-2xl space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
              <KeyRound size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">Change password</h1>
              <p className="text-sm text-slate-400 mt-1">
                {forced
                  ? `${name ? name + ", you" : "You"} signed in with a default password that everyone knows. Choose your own to continue.`
                  : "Choose a new password for your login."}
              </p>
            </div>
          </div>

          {error && (
            <div ref={errorRef} className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2.5">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-5">
            {field("Current password", current, setCurrent, "current-password")}
            {field("New password", next, setNext, "new-password")}
            {field("New password again", repeat, setRepeat, "new-password")}
            <p className="text-sm text-slate-400 flex gap-2">
              <ShieldCheck size={17} className="shrink-0 text-emerald-400 mt-0.5" />
              At least 8 characters, with a letter and a number.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-base font-bold disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save new password"}
            </button>
          </form>

          {forced && (
            <button
              type="button"
              onClick={() => fetch("/api/auth/logout", { method: "POST" }).finally(() => (window.location.href = "/login"))}
              className="w-full text-sm text-slate-400 hover:text-white"
            >
              Sign out instead
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
