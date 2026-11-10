import { NextResponse } from "next/server";

/** The API's build version, so the website can warn when the two IIS sites don't match. */
export async function GET() {
  return NextResponse.json(
    { success: true, version: process.env.APP_VERSION || "unknown" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
