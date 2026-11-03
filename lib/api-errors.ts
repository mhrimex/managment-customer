import { NextResponse } from "next/server";
import { DbUnavailableError, RuleError } from "@/lib/employees";

/** Turn errors from lib/employees into clean JSON responses. */
export function apiError(err: unknown, where: string, fallback: string) {
  if (err instanceof RuleError) {
    return NextResponse.json({ success: false, error: err.message }, { status: err.status });
  }
  if (err instanceof DbUnavailableError) {
    return NextResponse.json(
      { success: false, error: "The database is not reachable. Try again in a moment." },
      { status: 503 }
    );
  }
  console.error(`${where} error:`, err);
  return NextResponse.json({ success: false, error: fallback }, { status: 500 });
}
