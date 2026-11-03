import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function getDaysUntilRenewal(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  
  // Set both to midnight UTC for clean day difference
  const now = new Date();
  const utcNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const utcTarget = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  
  const diffMs = utcTarget - utcNow;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getRenewalBadge(renewalDate?: string | null, status?: string) {
  if (status === "SUSPENDED" || status === "DECOMMISSIONED") {
    return {
      text: status,
      variant: "rose",
      colorClass: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    };
  }

  const days = getDaysUntilRenewal(renewalDate);
  if (days === null) {
    return {
      text: "Perpetual / N/A",
      variant: "slate",
      colorClass: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    };
  }

  if (days < 0) {
    return {
      text: `Expired (${Math.abs(days)}d ago)`,
      variant: "rose",
      colorClass: "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse",
      urgent: true,
    };
  }

  if (days <= 7) {
    return {
      text: `Due in ${days} ${days === 1 ? 'day' : 'days'}`,
      variant: "amber",
      colorClass: "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse",
      urgent: true,
    };
  }

  if (days <= 30) {
    return {
      text: `Due in ${days} days`,
      variant: "amber",
      colorClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      urgent: false,
    };
  }

  return {
    text: `Renews ${formatDate(renewalDate)}`,
    variant: "emerald",
    colorClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    urgent: false,
  };
}

export function getStatusBadge(status: string) {
  switch (status) {
    case "ACTIVE":
      return {
        label: "Active",
        className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        dotColor: "bg-emerald-400",
      };
    case "MAINTENANCE":
      return {
        label: "Maintenance",
        className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
        dotColor: "bg-amber-400",
      };
    case "SUSPENDED":
      return {
        label: "Suspended",
        className: "bg-rose-500/15 text-rose-400 border-rose-500/30",
        dotColor: "bg-rose-400",
      };
    case "DECOMMISSIONED":
      return {
        label: "Decommissioned",
        className: "bg-slate-500/15 text-slate-400 border-slate-500/30",
        dotColor: "bg-slate-400",
      };
    case "EXPIRED":
      return {
        label: "Expired",
        className: "bg-rose-500/15 text-rose-400 border-rose-500/30",
        dotColor: "bg-rose-400",
      };
    case "NO_CONTRACT":
      return {
        label: "No Contract",
        className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
        dotColor: "bg-zinc-400",
      };
    default:
      return {
        label: status,
        className: "bg-slate-500/15 text-slate-300 border-slate-500/30",
        dotColor: "bg-slate-400",
      };
  }
}

export function getEnvironmentBadge(env: string) {
  switch (env) {
    case "PRODUCTION":
      return {
        label: "PROD",
        className: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
      };
    case "STAGING":
      return {
        label: "STAGE",
        className: "bg-sky-500/15 text-sky-400 border-sky-500/30",
      };
    case "TEST":
      return {
        label: "TEST",
        className: "bg-purple-500/15 text-purple-400 border-purple-500/30",
      };
    default:
      return {
        label: env,
        className: "bg-slate-500/15 text-slate-400 border-slate-500/30",
      };
  }
}

/** "Mohamad Haddad" -> "MH" (for avatars) */
export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}
