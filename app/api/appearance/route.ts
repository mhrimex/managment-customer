import { NextRequest, NextResponse } from "next/server";
import { getAppearance, saveAppearance } from "@/lib/appearance-store";
import { getCurrentUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { requireAdmin } from "@/lib/permissions";

/** Public (see middleware.ts): the login page uses the same look, and this holds no secrets. */
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await getAppearance() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/appearance error:", error);
    return NextResponse.json({ success: false, error: "Failed to load the appearance settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;
    const user = await getCurrentUser();
    const saved = await saveAppearance(await request.json());
    await logAuditEvent({
      user_id: user?.id,
      user_email: user?.email || "unknown",
      action: "UPDATE_APPEARANCE",
      resource_type: "SYSTEM",
      details: `Appearance: font size ${saved.fontSize}px, colour ${saved.color}, font ${saved.font}`,
    }).catch(() => {});
    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    console.error("PUT /api/appearance error:", error);
    return NextResponse.json({ success: false, error: "Failed to save the appearance settings" }, { status: 500 });
  }
}
