import { NextRequest, NextResponse } from "next/server";
import { getDeployments, createDeployment } from "@/lib/db";
import { DeploymentFilterParams } from "@/types";
import { checkDeployment } from "@/lib/checks";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filters: DeploymentFilterParams = {
      search: searchParams.get("search") || undefined,
      solution_id: searchParams.get("solution_id") || undefined,
      category: searchParams.get("category") || undefined,
      server_id: searchParams.get("server_id") || undefined,
      server_type: searchParams.get("server_type") || undefined,
      status: searchParams.get("status") || undefined,
      environment: searchParams.get("environment") || undefined,
      renewal_due: (searchParams.get("renewal_due") as any) || undefined,
      support_status: searchParams.get("support_status") || undefined,
    };

    const deployments = await getDeployments(filters);

    // CSV Export handler
    if (searchParams.get("export") === "csv") {
      const headers = [
        "Deployment ID",
        "Client Name",
        "Contact Person",
        "Client Phone",
        "Solution Name",
        "Category",
        "Server Name",
        "Server IP",
        "Instance URL",
        "Environment",
        "Database Name",
        "Version",
        "Status",
        "License Type",
        "Renewal Date",
        "Support Contract Status",
      ];

      const csvRows = deployments.map((d) => [
        `"${d.id}"`,
        `"${d.client?.company_name || ""}"`,
        `"${d.client?.contact_person || ""}"`,
        `"${d.client?.phone_primary || ""}"`,
        `"${d.solution?.name || ""}"`,
        `"${d.solution?.category || ""}"`,
        `"${d.server?.server_name || "Unassigned"}"`,
        `"${d.server?.ip_address || "N/A"}"`,
        `"${d.instance_url || ""}"`,
        `"${d.environment}"`,
        `"${d.database_name || ""}"`,
        `"${d.version_installed || ""}"`,
        `"${d.deployment_status}"`,
        `"${d.license_type}"`,
        `"${d.renewal_date || "N/A"}"`,
        `"${d.support_contract_status}"`,
      ]);

      const csvContent = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="deployments-export-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      count: deployments.length,
      data: deployments,
    });
  } catch (error) {
    console.error("GET /api/deployments error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve deployments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.client_id || !body.solution_id) {
      return NextResponse.json(
        { success: false, error: "client_id and solution_id are required" },
        { status: 400 }
      );
    }

    const checkError = await checkDeployment(body);
    if (checkError) {
      return NextResponse.json({ success: false, error: checkError }, { status: 400 });
    }

    const newDeployment = await createDeployment(body);

    return NextResponse.json(
      {
        success: true,
        message: "Deployment created successfully",
        data: newDeployment,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/deployments error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create deployment" },
      { status: 500 }
    );
  }
}
