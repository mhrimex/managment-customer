import { NextRequest, NextResponse } from "next/server";
import { getServers, createServer } from "@/lib/db";

export async function GET() {
  try {
    const servers = await getServers();
    return NextResponse.json({
      success: true,
      count: servers.length,
      data: servers,
    });
  } catch (error) {
    console.error("GET /api/servers error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve servers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.server_name || !body.ip_address || !body.provider) {
      return NextResponse.json(
        { success: false, error: "server_name, ip_address, and provider are required" },
        { status: 400 }
      );
    }

    const server = await createServer(body);

    return NextResponse.json(
      {
        success: true,
        message: "Server created successfully",
        data: server,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/servers error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create server" },
      { status: 500 }
    );
  }
}
