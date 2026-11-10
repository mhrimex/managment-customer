"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  Building2,
  Server as ServerIcon,
  Boxes,
  PlusCircle,
  ShieldCheck,
  HardDrive,
  ChevronRight,
  LogOut,
  User as UserIcon,
  Users,
  Sun,
  Moon,
  MonitorSmartphone,
  Contact,
  KeyRound,
  Settings,
} from "lucide-react";
import { SessionUser } from "@/types";
import BrandLogo from "@/components/BrandLogo";
import { ModalCloseButton, useDismissable, whenModalHistorySettled } from "@/components/ModalShell";
import { useTheme, ThemePref } from "@/components/useTheme";
import { useVersionInfo } from "@/components/useVersionInfo";

interface SidebarProps {
  onOpenNewDeployment?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  onOpenNewDeployment,
  isOpenMobile,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  };

  const navLinks: { name: string; href: string; icon: React.ElementType; exact?: boolean; badge?: string; adminOnly?: boolean }[] = [
    {
      name: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      name: "Deployments",
      href: "/deployments",
      icon: Layers,
      badge: "Grid",
    },
    {
      name: "Clients",
      href: "/clients",
      icon: Building2,
    },
    {
      name: "Employees",
      href: "/employees",
      icon: Contact,
    },
    {
      name: "Access Report",
      href: "/access",
      icon: KeyRound,
    },
    {
      name: "Servers & Infra",
      href: "/servers",
      icon: ServerIcon,
    },
    {
      name: "Solutions Catalog",
      href: "/solutions",
      icon: Boxes,
    },
    {
      name: "Audit Trail",
      href: "/audit-logs",
      icon: ShieldCheck,
      badge: "Security",
    },
    {
      name: "Staff Users",
      href: "/users",
      icon: Users,
      badge: "RBAC",
    },
    {
      name: "Backup & Data",
      href: "/maintenance",
      icon: HardDrive,
      badge: "Ops",
      adminOnly: true,
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
    },
  ].filter((link) => !link.adminOnly || currentUser?.role === "ADMIN");

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  // In the phone menu: close the menu first, then change page (so the menu's
  // Back-button history entry is gone before the new page is pushed).
  const go = (mobile: boolean) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!mobile || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    const href = e.currentTarget.getAttribute("href") || "/";
    onCloseMobile?.();
    whenModalHistorySettled().then(() => router.push(href));
  };

  const renderContent = (mobile: boolean) => (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800/80 w-[18.5rem] max-w-[85vw] select-none">
      {/* Brand Header */}
      <div className="px-5 py-5 sm:py-6 border-b border-slate-800/80 flex items-center justify-between gap-2">
        <Link
          href="/"
          onClick={go(mobile)}
          className="block min-w-0 transition-transform hover:scale-[1.02]"
        >
          <BrandLogo size={mobile ? 42 : 48} />
        </Link>
        {mobile && onCloseMobile && <ModalCloseButton onClick={onCloseMobile} />}
      </div>

      {/* Quick Action Button */}
      {onOpenNewDeployment && (
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={() => {
              if (mobile && onCloseMobile) {
                onCloseMobile();
                whenModalHistorySettled().then(() => onOpenNewDeployment());
              } else {
                onOpenNewDeployment();
              }
            }}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-base shadow-md shadow-indigo-600/25 transition-all hover:shadow-indigo-600/40 active:scale-[0.98]"
          >
            <PlusCircle size={20} />
            <span>New Deployment</span>
          </button>
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 px-3.5 py-4 space-y-1.5 overflow-y-auto">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-[0.12em] px-3.5 mb-3">
          Management
        </div>
        {navLinks.map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={go(mobile)}
              className={`relative flex items-center justify-between px-3.5 py-3 rounded-xl text-base font-semibold transition-all border ${
                active
                  ? "bg-indigo-500/10 text-white border-indigo-500/30 shadow-sm"
                  : "text-slate-300 border-transparent hover:text-white hover:bg-slate-900"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-indigo-400" />
              )}
              <div className="flex items-center gap-3.5">
                <Icon
                  size={22}
                  className={active ? "text-indigo-400" : "text-slate-400"}
                />
                <span className="font-semibold">{item.name}</span>
              </div>
              {item.badge ? (
                <span className="text-[10px] uppercase tracking-wide bg-slate-800/80 text-slate-400 px-2 py-0.5 rounded-md border border-slate-700/70 font-semibold">
                  {item.badge}
                </span>
              ) : active ? (
                <ChevronRight size={17} className="text-slate-400" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* User Session Profile & Logout Footer */}
      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-slate-800/80 bg-slate-950/60 text-xs space-y-3">
        <ThemePicker />
        {currentUser ? (
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 min-w-0 pr-1">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white font-display font-extrabold flex items-center justify-center shrink-0 shadow-md">
                {currentUser.name
                  .split(/\s+/)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || <UserIcon size={20} />}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-slate-100 text-base truncate">
                  {currentUser.name}
                </div>
                <div className="text-xs text-indigo-400 uppercase tracking-wide truncate font-bold">
                  {currentUser.role.replace("_", " ")}
                </div>
                <Link href="/change-password" onClick={go(mobile)} className="text-xs text-slate-400 hover:text-white hover:underline">
                  Change password
                </Link>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
              title="Sign Out"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between text-slate-300 text-xs">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-slate-200">Session Active</span>
            </span>
            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-rose-400 hover:underline"
            >
              Sign Out
            </button>
          </div>
        )}

        <VersionLine />
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex shrink-0 h-screen sticky top-0 z-30">
        {renderContent(false)}
      </aside>

      {isOpenMobile && onCloseMobile && (
        <MobileDrawer onClose={onCloseMobile}>{renderContent(true)}</MobileDrawer>
      )}
    </>
  );
}

/** Slide-in menu for phones: ✕ button, tap outside, Escape and the Back button all close it. */
function MobileDrawer({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const tryClose = useDismissable(onClose);
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden flex"
      onClick={tryClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className="h-full animate-in slide-in-from-left duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/** The build version, with a warning when the website and API sites don't match. */
function VersionLine() {
  const { website, mismatch } = useVersionInfo();
  return mismatch ? (
    <Link href="/settings" className="block text-xs font-semibold text-amber-400 hover:underline">
      Website and API versions differ. See Settings.
    </Link>
  ) : (
    <div className="text-xs text-slate-500 font-mono text-center">Version {website}</div>
  );
}

/** Light / Dark / Auto (follow the phone or PC). Saved per browser. */
function ThemePicker() {
  const { pref, setPref } = useTheme();
  const options: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "system", label: "Auto", Icon: MonitorSmartphone },
  ];
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
      {options.map(({ value, label, Icon }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPref(value)}
            title={value === "system" ? "Follow the device setting" : `${label} theme`}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              active ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
