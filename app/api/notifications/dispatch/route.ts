import { NextRequest, NextResponse } from "next/server";
import { checkAndDispatchRenewalAlerts } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const triggeredBy = user ? `${user.name} (${user.email})` : "Manual System Trigger";

    const result = await checkAndDispatchRenewalAlerts(user?.email || "system@omniops.internal");

    return NextResponse.json({
      success: true,
      message: `Dispatched alerts for ${result.alerts_count} upcoming license renewals.`,
      data: result,
    });
  } catch (error) {
    console.error("POST /api/notifications/dispatch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to dispatch renewal notifications" },
      { status: 500 }
    );
  }
}
