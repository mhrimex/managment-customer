"use client";

import { createPortal } from "react-dom";
import { useDismissable, whenModalHistorySettled } from "@/components/ModalShell";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Menu,
  Bell,
  Plus,
  Sun,
  Moon,
  AlertTriangle,
  Building2,
  ExternalLink,
  Send,
  CheckCircle2,
  ShieldCheck
} from "lucide-react";
import { DashboardMetrics } from "@/types";

interface NavbarProps {
  onOpenSearch: () => void;
  onOpenMobileMenu: () => void;
  onOpenNewDeployment?: () => void;
  onOpenNewClient?: () => void;
}

export default function Navbar({
  onOpenSearch,
  onOpenMobileMenu,
  onOpenNewDeployment,
  onOpenNewClient,
}: NavbarProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const router = useRouter();
  // close the alerts panel first, then change page
  const closeAlertsAndGo = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    const href = e.currentTarget.getAttribute("href") || "/";
    setShowAlertsDropdown(false);
    whenModalHistorySettled().then(() => router.push(href));
  };
  const [isDark, setIsDark] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchMessage, setDispatchMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setMetrics(data.data);
        }
      })
      .catch((err) => console.error("Error fetching stats:", err));
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("reflection_theme");
      if (saved === "light") {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
        setIsDark(false);
      } else {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
        setIsDark(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleTheme = () => {
    const isCurrentlyDark = document.documentElement.classList.contains("dark");
    if (isCurrentlyDark) {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      try {
        localStorage.setItem("reflection_theme", "light");
      } catch {}
      setIsDark(false);
    } else {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
      try {
        localStorage.setItem("reflection_theme", "dark");
      } catch {}
      setIsDark(true);
    }
  };

  const handleTriggerDispatch = async () => {
    setDispatching(true);
    setDispatchMessage(null);
    try {
      const res = await fetch("/api/notifications/dispatch", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setDispatchMessage(`Dispatched alerts for ${data.data.alerts_count} urgent licenses.`);
      } else {
        setDispatchMessage(data.error || "Failed to dispatch alerts.");
      }
    } catch {
      setDispatchMessage("Error communicating with dispatcher.");
    } finally {
      setDispatching(false);
      setTimeout(() => setDispatchMessage(null), 5000);
    }
  };

  const expiringCount = metrics ? metrics.expiring_30_days + metrics.expired_licenses : 0;

  return (
    <header className="sticky top-0 z-20 h-[4.5rem] bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-4 md:px-7 lg:px-10 flex items-center justify-between gap-2 sm:gap-4">
      {/* Left section: mobile hamburger & search bar */}
      <div className="flex items-center gap-1.5 sm:gap-3 flex-1 min-w-0 max-w-2xl">
        <button
          onClick={onOpenMobileMenu}
          className="shrink-0 w-11 h-11 inline-flex items-center justify-center text-slate-300 hover:text-white rounded-xl hover:bg-slate-900 md:hidden"
          aria-label="Open Navigation Menu"
        >
          <Menu size={24} />
        </button>

        {/* Global Search Trigger Input */}
        <button
          onClick={onOpenSearch}
          className="w-full min-w-0 flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 text-base text-slate-400 hover:text-white transition-all shadow-inner group"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <Search size={19} className="shrink-0 text-slate-400 group-hover:text-indigo-400 transition-colors" />
            <span className="hidden sm:inline truncate">Search clients, servers, domains, IPs, solutions...</span>
            <span className="sm:hidden truncate whitespace-nowrap">Search...</span>
          </span>
          <kbd className="hidden sm:inline-flex items-center gap-1 font-mono text-xs bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right section: Quick actions, notifications, theme */}
      <div className="flex items-center gap-0.5 sm:gap-2.5 shrink-0">
        {/* Quick New Client button */}
        {onOpenNewClient && (
          <button
            onClick={onOpenNewClient}
            className="hidden lg:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-sm font-semibold text-slate-200 transition-colors"
          >
            <Building2 size={17} className="text-emerald-400" />
            <span>Add Client</span>
          </button>
        )}

        {/* Quick New Deployment button */}
        {onOpenNewDeployment && (
          <button
            onClick={onOpenNewDeployment}
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-glow transition-colors"
          >
            <Plus size={18} />
            <span>Deploy Solution</span>
          </button>
        )}

        {/* Expiring Licenses Alert Bell */}
        <div className="relative">
          <button
            onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
            className="w-11 h-11 inline-flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 relative transition-colors"
            title="Renewal Alerts"
            aria-label="Renewal alerts"
          >
            <Bell size={22} />
            {expiringCount > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-slate-950 animate-pulse" />
            )}
          </button>

          {/* Alerts Dropdown Modal */}
          {showAlertsDropdown && (
            <AlertsPopover onClose={() => setShowAlertsDropdown(false)}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="font-semibold text-white flex items-center gap-2">
                  <AlertTriangle size={15} className="text-amber-400" />
                  Renewal Alerts ({expiringCount})
                </span>
                <Link
                  href="/deployments?renewal_due=30"
                  onClick={closeAlertsAndGo}
                  className="text-sm font-semibold text-indigo-400 hover:underline px-2 py-1"
                >
                  View All
                </Link>
              </div>

              {/* Renewal Dispatcher Trigger Button */}
              <div className="my-2.5 p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-200 text-[11px]">Dispatcher (Slack / Email)</div>
                  <div className="text-[10px] text-slate-400">Trigger webhook alert scan</div>
                </div>
                <button
                  onClick={handleTriggerDispatch}
                  disabled={dispatching}
                  className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  <Send size={11} className={dispatching ? "animate-pulse" : ""} />
                  <span>{dispatching ? "Sending..." : "Dispatch"}</span>
                </button>
              </div>

              {dispatchMessage && (
                <div className="p-2 mb-2 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="shrink-0" />
                  <span>{dispatchMessage}</span>
                </div>
              )}

              <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                {metrics?.upcoming_renewals && metrics.upcoming_renewals.length > 0 ? (
                  metrics.upcoming_renewals.map((item) => (
                    <Link
                      key={item.id}
                      href={`/clients/${item.client_id}`}
                      onClick={closeAlertsAndGo}
                      className="block p-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/40 text-left transition-colors"
                    >
                      <div className="flex items-center justify-between text-slate-200 font-medium">
                        <span className="truncate">{item.client?.company_name}</span>
                        <span className="text-[11px] text-amber-400 font-mono">
                          {item.renewal_date}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {item.solution?.name} • {item.instance_url || "Domain unassigned"}
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="py-4 text-center text-slate-400">
                    No urgent renewals due in next 30 days!
                  </div>
                )}
              </div>
            </AlertsPopover>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="w-11 h-11 inline-flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun size={22} /> : <Moon size={22} />}
        </button>
      </div>
    </header>
  );
}

/** Renewal alerts panel: full-width sheet under the header on phones, dropdown on desktop.
 *  Tap outside, Escape or the phone's Back button closes it. */
function AlertsPopover({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const tryClose = useDismissable(onClose);
  // Rendered into <body>: the header's backdrop-blur would otherwise trap position:fixed inside it.
  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/50 sm:bg-black/20" onClick={tryClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label="Renewal alerts"
        className="fixed left-3 right-3 top-[4.9rem] sm:left-auto sm:right-6 sm:w-[28rem] max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 z-50 text-sm animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body
  );
}
