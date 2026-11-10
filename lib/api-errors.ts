import { NextResponse } from "next/server";
import { DbUnavailableError, RuleError } from "@/lib/employees";
import { requireAdmin } from "@/lib/permissions";
import { findUsage } from "@/lib/usage";
import { UsageKind } from "@/types/usage";

/** Turn errors from lib/employees into clean JSON responses. */
export function apiError(err: unknown, where: string, fallback: string) {
  if (err instanceof RuleError) {
    return NextResponse.json({ success: false, error: err.message }, { status: err.status });
  }
  if (err instanceof DbUnavailableError) {
    return NextResponse.json(
      { success: false, error: "The database is not reachable. Try again in a moment." },
      { status: 503 }
    );
  }
  console.error(`${where} error:`, err);
  return NextResponse.json({ success: false, error: fallback }, { status: 500 });
}

/**
 * Call first in every DELETE route. Returns the response to send when the user isn't an admin
 * (403), the item does not exist (404) or is still in use (409, with the full list),
 * or null when it can be deleted.
 */
export async function refuseDelete(kind: UsageKind, id: string): Promise<NextResponse | null> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const usage = await findUsage(kind, id);
  if (!usage) return NextResponse.json({ success: false, error: "This item no longer exists" }, { status: 404 });
  const count = usage.groups.reduce((n, g) => n + g.items.length, 0);
  if (!count) return null;
  return NextResponse.json(
    { success: false, error: `${usage.name} can't be deleted yet: ${count} item(s) still use it.`, in_use: usage },
    { status: 409 }
  );
}
