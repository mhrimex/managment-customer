import { NextRequest, NextResponse } from "next/server";
import { deploymentsOnServer } from "@/lib/employees";
import { apiError } from "@/lib/api-errors";

/** Deployments on this server = what a server account can be given access to. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const data = await deploymentsOnServer((await params).id);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return apiError(err, "GET /api/servers/[id]/deployments", "Failed to load deployments");
  }
}
