import { NextRequest, NextResponse } from "next/server";
import { addCredential, deleteCredential, revealCredential } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { requireAdmin } from "@/lib/permissions";

/**
 * GET /api/credentials?id=<credential id>&purpose=reveal|copy
 * Returns ONE decrypted secret and records who read it. List endpoints never
 * include secret values.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const purpose = searchParams.get("purpose") === "copy" ? "Copied" : "Revealed";
    if (!id) {
      return NextResponse.json({ success: false, error: "Credential id is required" }, { status: 400 });
    }

    const cred = await revealCredential(id);
    if (!cred) {
      return NextResponse.json({ success: false, error: "Credential not found" }, { status: 404 });
    }

    await logAuditEvent({
      user_id: user.id,
      user_email: user.email,
      action: "VIEW_CREDENTIAL",
      resource_type: "CREDENTIAL",
      resource_id: cred.id,
      details: `${purpose} vault credential "${cred.key_label}"`,
      ip_address: request.headers.get("x-forwarded-for") || "127.0.0.1",
    }).catch(() => {});

    return NextResponse.json(
      { success: true, data: { id: cred.id, key_label: cred.key_label, key_value: cred.key_value } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("GET /api/credentials error:", error);
    return NextResponse.json({ success: false, error: "Failed to read credential" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deployment_id, key_label, key_value } = body;

    if (!deployment_id || !key_label || !key_value) {
      return NextResponse.json(
        { success: false, error: "deployment_id, key_label, and key_value are required" },
        { status: 400 }
      );
    }

    const cred = await addCredential(deployment_id, key_label, key_value);
    return NextResponse.json({
      success: true,
      message: "Credential added to vault",
      data: cred,
    });
  } catch (error) {
    console.error("POST /api/credentials error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to store credential" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Credential id is required" },
        { status: 400 }
      );
    }

    const deleted = await deleteCredential(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Credential not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Credential deleted",
    });
  } catch (error) {
    console.error("DELETE /api/credentials error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete credential" },
      { status: 500 }
    );
  }
}
