import React from "react";
import { getStatusBadge, getEnvironmentBadge } from "@/lib/utils";

export function StatusBadge({ status }: { status: string }) {
  const badge = getStatusBadge(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
      {badge.label}
    </span>
  );
}

export function EnvironmentBadge({ env }: { env: string }) {
  const badge = getEnvironmentBadge(env);
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold tracking-wider border font-mono-code ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}export default StatusBadge;
