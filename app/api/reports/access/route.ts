import { NextResponse } from "next/server";
import { accessReport } from "@/lib/employees";
import { apiError } from "@/lib/api-errors";

/** Who can open what, one row per employee + account + deployment. Passwords are never included. */
export async function GET() {
  try {
    const data = await accessReport();
    return NextResponse.json({ success: true, count: data.length, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return apiError(err, "GET /api/reports/access", "Failed to load the access report");
  }
}
