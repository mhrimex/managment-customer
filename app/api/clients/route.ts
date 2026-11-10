import { NextRequest, NextResponse } from "next/server";
import { getClients, createClient } from "@/lib/db";
import { validateLogo } from "@/lib/validation";
import { checkClient } from "@/lib/checks";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const clients = await getClients({ search });

    return NextResponse.json({
      success: true,
      count: clients.length,
      data: clients,
    });
  } catch (error) {
    console.error("GET /api/clients error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve clients" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.company_name || !body.company_name.trim()) {
      return NextResponse.json(
        { success: false, error: "Company name is required" },
        { status: 400 }
      );
    }

    const logoError = validateLogo(body.logo_url);
    if (logoError) {
      return NextResponse.json({ success: false, error: logoError }, { status: 400 });
    }

    const checkError = await checkClient(body);
    if (checkError) {
      return NextResponse.json({ success: false, error: checkError }, { status: 400 });
    }

    const client = await createClient(body);

    return NextResponse.json(
      {
        success: true,
        message: "Client created successfully",
        data: client,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/clients error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create client" },
      { status: 500 }
    );
  }
}
