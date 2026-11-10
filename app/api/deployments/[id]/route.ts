import { NextRequest, NextResponse } from "next/server";
import { getDeploymentById, updateDeployment, deleteDeployment } from "@/lib/db";
import { refuseDelete } from "@/lib/api-errors";
import { ACCESS_GROUP, findUsage } from "@/lib/usage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deployment = await getDeploymentById(id);

    if (!deployment) {
      return NextResponse.json(
        { success: false, error: "Deployment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: deployment });
  } catch (error) {
    console.error("GET /api/deployments/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch deployment" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Employees' access points at this exact company + solution + server.
    // Refuse a change that would silently remove it or point it at something else.
    const existing = await getDeploymentById(id);
    if (existing) {
      const changed = (["client_id", "solution_id", "server_id"] as const).some(
        (key) => body[key] !== undefined && String(body[key] ?? "").toLowerCase() !== String(existing[key] ?? "").toLowerCase()
      );
      if (changed) {
        const usage = await findUsage("deployment", id);
        const access = usage?.groups.find((g) => g.title === ACCESS_GROUP);
        if (access) {
          const names = access.items.map((i) => i.label).join(", ");
          return NextResponse.json(
            { success: false, error: `Can't change the client, solution or server while these accounts have access: ${names}. Untick this deployment on each employee's page first.` },
            { status: 409 }
          );
        }
      }
    }

    const updated = await updateDeployment(id, body);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Deployment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Deployment updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("PUT /api/deployments/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update deployment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const refused = await refuseDelete("deployment", id);
    if (refused) return refused;
    const deleted = await deleteDeployment(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Deployment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Deployment deleted successfully",
    });
  } catch (error) {
    console.error("DELETE /api/deployments/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete deployment" },
      { status: 500 }
    );
  }
}
