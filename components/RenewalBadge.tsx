import React from "react";
import { getRenewalBadge } from "@/lib/utils";
import { AlertCircle, Calendar } from "lucide-react";

interface RenewalBadgeProps {
  date?: string | null;
  status?: string;
  showIcon?: boolean;
}

export default function RenewalBadge({
  date,
  status,
  showIcon = true,
}: RenewalBadgeProps) {
  const badge = getRenewalBadge(date, status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all ${badge.colorClass}`}
    >
      {showIcon && (
        badge.urgent ? (
          <AlertCircle size={12} className="shrink-0 text-current" />
        ) : (
          <Calendar size={12} className="shrink-0 opacity-70" />
        )
      )}
      <span>{badge.text}</span>
    </span>
  );
}
