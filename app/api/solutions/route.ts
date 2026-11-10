import { NextRequest, NextResponse } from "next/server";
import { getSolutions, createSolution, SOLUTION_CATEGORIES } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { checkSolution } from "@/lib/checks";

export async function GET() {
  try {
    const solutions = await getSolutions();
    return NextResponse.json({
      success: true,
      count: solutions.length,
      data: solutions,
    });
  } catch (error) {
    console.error("GET /api/solutions error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve solutions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await request.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ success: false, error: "Solution name is required" }, { status: 400 });
    }
    if (name.length > 255) {
      return NextResponse.json({ success: false, error: "Solution name is too long (max 255 characters)" }, { status: 400 });
    }
    if (body.category && !SOLUTION_CATEGORIES.includes(body.category)) {
      return NextResponse.json({ success: false, error: "Invalid solution category" }, { status: 400 });
    }

    const duplicate = await checkSolution(name);
    if (duplicate) return NextResponse.json({ success: false, error: duplicate }, { status: 400 });

    const solution = await createSolution({ name, category: body.category, description: body.description });

    await logAuditEvent({
      user_id: user?.id,
      user_email: user?.email || "unknown",
      action: "CREATE_SOLUTION",
      resource_type: "SOLUTION",
      resource_id: solution.id,
      details: `Added solution "${solution.name}" (${solution.category}) to the catalog`,
    }).catch(() => {});

    return NextResponse.json(
      { success: true, message: "Solution created successfully", data: solution },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/solutions error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create solution" },
      { status: 500 }
    );
  }
}
