import { NextRequest, NextResponse } from "next/server";
import { companiesOnServer } from "@/lib/employees";
import { apiError } from "@/lib/api-errors";

/** Companies deployed on this server = the companies a server account can be given access to. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const data = await companiesOnServer((await params).id);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return apiError(err, "GET /api/servers/[id]/companies", "Failed to load companies");
  }
}
