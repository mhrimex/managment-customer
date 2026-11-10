"use client";

import { useCallback } from "react";
import { useFeedback } from "@/components/Feedback";
import { UsageKind } from "@/types/usage";

const API: Record<UsageKind, string> = {
  company: "/api/clients",
  solution: "/api/solutions",
  server: "/api/servers",
  deployment: "/api/deployments",
  employee: "/api/employees",
  account: "/api/server-accounts",
};

const readJson = (res: Response) => res.json().catch(() => null);

/**
 * Delete with the "still in use" rule: asks the API what uses the item and, if anything does,
 * shows the list instead of offering to delete. Otherwise asks to confirm, then deletes.
 * Resolves to true only when the item was deleted; every other outcome is already shown.
 */
export function useSafeDelete() {
  const { toast, confirm, showInUse } = useFeedback();

  return useCallback(
    async (options: { kind: UsageKind; id: string; title: string; message: string; confirmLabel: string }): Promise<boolean> => {
      const { kind, id, title, message, confirmLabel } = options;
      try {
        const check = await fetch(`/api/usage/${kind}/${id}`, { cache: "no-store" });
        const usage = await readJson(check);
        if (!check.ok || !usage?.success) {
          throw new Error(usage?.error || "Could not check where this is used. Make sure the API and website are the same version.");
        }
        if (usage.can_delete === false) {
          toast("Only an admin can delete. Ask an admin.", "error");
          return false;
        }
        if (usage.data.groups.length) {
          showInUse(usage.data);
          return false;
        }

        if (!(await confirm({ title, message, confirmLabel, danger: true }))) return false;

        const res = await fetch(`${API[kind]}/${id}`, { method: "DELETE" });
        const result = await readJson(res);
        // something started using it between the check and the delete
        if (res.status === 409 && result?.in_use) {
          showInUse(result.in_use);
          return false;
        }
        if (!res.ok || !result?.success) throw new Error(result?.error || "Failed to delete");
        return true;
      } catch (err: any) {
        toast(err?.message || "Failed to delete", "error");
        return false;
      }
    },
    [toast, confirm, showInUse]
  );
}
