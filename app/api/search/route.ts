import { NextRequest, NextResponse } from "next/server";
import { searchAll } from "@/lib/db";
import { listEmployees } from "@/lib/employees";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const results = await searchAll(q);

    // Employees: by name, email, phone, company, or any of their server usernames
    if (q.trim()) {
      try {
        const ql = q.trim().toLowerCase();
        results.employees = (await listEmployees({ search: q })).slice(0, 5).map((e) => {
          const hits = (e.accounts || []).filter((a) => a.username.toLowerCase().includes(ql));
          const shown = hits.length ? hits : e.accounts || [];
          const logins = shown.map((a) => `${a.username} @ ${a.server_name}`).join(", ");
          return {
            id: e.id,
            title: e.full_name,
            subtitle: [logins, e.client_name].filter(Boolean).join(" • ") || "Employee",
            type: "employee" as const,
          };
        });
      } catch {
        results.employees = []; // database unavailable: the other results still work
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("GET /api/search error:", error);
    return NextResponse.json(
      { success: false, error: "Search failed" },
      { status: 500 }
    );
  }
}
