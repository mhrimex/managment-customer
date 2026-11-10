import { NextRequest, NextResponse } from "next/server";
import { deploymentsNotOnServer, deploymentsOnServer } from "@/lib/employees";
import { apiError } from "@/lib/api-errors";

/**
 * data: deployments on this server = what a server account can be given access to.
 * others: everything else, so the form can explain why those can't be selected.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [data, others] = await Promise.all([deploymentsOnServer(id), deploymentsNotOnServer(id)]);
    return NextResponse.json({ success: true, data, others });
  } catch (err) {
    return apiError(err, "GET /api/servers/[id]/deployments", "Failed to load deployments");
  }
}
