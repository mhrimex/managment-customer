import { NextRequest, NextResponse } from "next/server";
import { updateSolution, deleteSolution, SOLUTION_CATEGORIES } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { refuseDelete } from "@/lib/api-errors";
import { checkSolution } from "@/lib/checks";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const body = await request.json();

    if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) {
      return NextResponse.json({ success: false, error: "Solution name cannot be empty" }, { status: 400 });
    }
    if (body.category && !SOLUTION_CATEGORIES.includes(body.category)) {
      return NextResponse.json({ success: false, error: "Invalid solution category" }, { status: 400 });
    }

    const duplicate = await checkSolution(body.name, id);
    if (duplicate) return NextResponse.json({ success: false, error: duplicate }, { status: 400 });

    const updated = await updateSolution(id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Solution not found" }, { status: 404 });
    }

    await logAuditEvent({
      user_id: user?.id,
      user_email: user?.email || "unknown",
      action: "UPDATE_SOLUTION",
      resource_type: "SOLUTION",
      resource_id: id,
      details: `Updated solution "${updated.name}"`,
    }).catch(() => {});

    return NextResponse.json({ success: true, message: "Solution updated successfully", data: updated });
  } catch (error) {
    console.error("PUT /api/solutions/[id] error:", error);
    return NextResponse.json({ success: false, error: "Failed to update solution" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const refused = await refuseDelete("solution", id);
    if (refused) return refused;
    const result = await deleteSolution(id);

    if (result === "in_use") {
      return NextResponse.json(
        { success: false, error: "This solution is still used by deployments. Delete or move those deployments first." },
        { status: 409 }
      );
    }
    if (result === "not_found") {
      return NextResponse.json({ success: false, error: "Solution not found" }, { status: 404 });
    }

    await logAuditEvent({
      user_id: user?.id,
      user_email: user?.email || "unknown",
      action: "DELETE_SOLUTION",
      resource_type: "SOLUTION",
      resource_id: id,
      details: "Removed a solution from the catalog",
    }).catch(() => {});

    return NextResponse.json({ success: true, message: "Solution deleted" });
  } catch (error) {
    console.error("DELETE /api/solutions/[id] error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete solution" }, { status: 500 });
  }
}
