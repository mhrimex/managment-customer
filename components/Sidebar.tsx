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
  Users
} from "lucide-react";
import { SessionUser } from "@/types";
import BrandLogo from "@/components/BrandLogo";

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

  const navLinks = [
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
    },
  ];

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const content = (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800/80 w-[18.5rem] select-none">
      {/* Brand Header */}
      <div className="px-5 py-6 border-b border-slate-800/80">
        <Link
          href="/"
          onClick={onCloseMobile}
          className="block transition-transform hover:scale-[1.02]"
        >
          <BrandLogo size={48} />
        </Link>
      </div>

      {/* Quick Action Button */}
      {onOpenNewDeployment && (
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={() => {
              onOpenNewDeployment();
              if (onCloseMobile) onCloseMobile();
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
              onClick={onCloseMobile}
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
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 text-xs space-y-3">
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
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
              title="Sign Out"
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

      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex shrink-0 h-screen sticky top-0 z-30">
        {content}
      </aside>

      {isOpenMobile && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden flex"
          onClick={onCloseMobile}
        >
          <div 
            className="h-full animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {content}
          </div>
        </div>
      )}
    </>
  );
}
