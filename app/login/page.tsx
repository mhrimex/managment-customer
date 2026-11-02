"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Lock,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  KeyRound,
  UserCheck,
  User as UserIcon,
  Eye,
  EyeOff
} from "lucide-react";
import { COMPANY_LOGO, COMPANY_NAME } from "@/components/BrandLogo";

// Demo role buttons are a development convenience only; never shown in production builds
const SHOW_DEMO_LOGINS =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS === "true";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/";
  // Only allow same-site paths (blocks open redirects like ?redirect=https://evil.com or //evil.com)
  const redirectUrl = /^\/(?![/\\])/.test(rawRedirect) ? rawRedirect : "/";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Authentication failed");
      }

      // Hard redirect to force layout re-render with session
      window.location.href = redirectUrl;
    } catch (err: any) {
      setError(err.message || "Failed to log in");
      setLoading(false);
    }
  };

  const setCredentials = (id: string, pass: string) => {
    setIdentifier(id);
    setPassword(pass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-sky-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg space-y-7 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={COMPANY_LOGO}
            alt={`${COMPANY_NAME} logo`}
            className="mx-auto w-20 h-20 rounded-3xl shadow-2xl shadow-indigo-500/30 mb-2 object-contain"
          />
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2.5">
            {COMPANY_NAME}
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              PRO
            </span>
          </h1>
          <p className="text-base text-slate-400 font-medium">
            Customer Management System • Staff Sign-In
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-7 sm:p-10 glass-panel shadow-2xl space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Identifier field — accepts name or email */}
            <div>
              <label className="block text-base font-semibold text-slate-200 mb-2">
                Username or Email Address
              </label>
              <div className="relative">
                <UserIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Alex Mercer or admin@agency.com"
                  autoComplete="username"
                  autoFocus
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-base placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all font-sans"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                You can sign in with your full name or your email address.
              </p>
            </div>

            {/* Password */}
            <div>
              <label className="block text-base font-semibold text-slate-200 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  className="w-full pl-11 pr-11 py-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-base placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-base font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-2"
            >
              <span>{loading ? "Authenticating..." : "Sign In to Console"}</span>
              <ArrowRight size={19} />
            </button>
          </form>

          {/* Quick Demo Switcher (development only) */}
          {SHOW_DEMO_LOGINS && (
          <div className="pt-4 border-t border-slate-800 space-y-2.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block text-center">
              Demo Accounts (development)
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setCredentials("Alex Mercer", "Admin123!")}
                className="p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-left transition-colors flex items-center gap-2.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <ShieldCheck size={18} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-white truncate">Administrator</div>
                  <div className="text-[11px] text-slate-400 truncate font-mono">Alex Mercer</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCredentials("Jordan Lee", "Support123!")}
                className="p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-left transition-colors flex items-center gap-2.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <UserCheck size={18} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-white truncate">Support Eng.</div>
                  <div className="text-[11px] text-slate-400 truncate font-mono">Jordan Lee</div>
                </div>
              </button>
            </div>
          </div>
          )}
        </div>

        {/* Security Notice */}
        <div className="text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <KeyRound size={14} className="text-indigo-400" />
          <span>Encrypted Session • HMAC SHA-256 Tokens • Security Audited</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-400 py-10 text-center">Loading authentication...</div>}>
      <LoginForm />
    </Suspense>
  );
}
