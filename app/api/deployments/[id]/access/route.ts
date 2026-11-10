import { NextRequest, NextResponse } from "next/server";
import { setDeploymentAccess } from "@/lib/employees";
import { getCurrentUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { apiError } from "@/lib/api-errors";

/** PUT /api/deployments/<id>/access  { account_ids: [...] }  - replace who can open this deployment */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const body = await request.json();
    const result = await setDeploymentAccess(id, body?.account_ids);
    if (!result) return NextResponse.json({ success: false, error: "Deployment not found" }, { status: 404 });
    if (result.added.length || result.removed.length) {
      const parts = [
        result.added.length ? `gave access to ${result.added.join(", ")}` : "",
        result.removed.length ? `removed access from ${result.removed.join(", ")}` : "",
      ].filter(Boolean);
      await logAuditEvent({
        user_id: user?.id,
        user_email: user?.email || "unknown",
        action: "UPDATE_ACCESS",
        resource_type: "DEPLOYMENT",
        resource_id: id,
        details: `${result.name}: ${parts.join("; ")}`,
      }).catch(() => {});
    }
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return apiError(err, "PUT /api/deployments/[id]/access", "Failed to save access");
  }
}
