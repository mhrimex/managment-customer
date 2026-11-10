import { NextRequest, NextResponse } from "next/server";
import { findUsage, USAGE_KINDS } from "@/lib/usage";
import { apiError } from "@/lib/api-errors";
import { isAdmin } from "@/lib/permissions";
import { UsageKind } from "@/types/usage";

/** What still uses this item. The delete buttons ask this before offering to delete. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  try {
    const { kind, id } = await params;
    if (!USAGE_KINDS.includes(kind as UsageKind)) {
      return NextResponse.json({ success: false, error: "Unknown item type" }, { status: 400 });
    }
    const usage = await findUsage(kind as UsageKind, id);
    if (!usage) return NextResponse.json({ success: false, error: "This item no longer exists" }, { status: 404 });
    return NextResponse.json({ success: true, data: usage, can_delete: await isAdmin() });
  } catch (err) {
    return apiError(err, "GET /api/usage", "Could not check where this is used");
  }
}
