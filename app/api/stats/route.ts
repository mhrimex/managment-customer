import { NextResponse } from "next/server";
import { getDashboardMetrics } from "@/lib/db";

export async function GET() {
  try {
    const metrics = await getDashboardMetrics();
    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error("GET /api/stats error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load dashboard metrics" },
      { status: 500 }
    );
  }
}
