import { NextRequest, NextResponse } from "next/server";
import { getDeploymentById, updateDeployment, deleteDeployment } from "@/lib/db";

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
