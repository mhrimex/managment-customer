/**
 * Who may do what:
 *   Admin            everything
 *   Support engineer view, add and edit, but no deleting, backup, restore, reset or site settings
 *
 * The role is read from the database, not the session cookie, so taking away someone's
 * admin role (or deleting their user) applies immediately instead of when their login expires.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserById } from "@/lib/db";

export async function isAdmin(): Promise<boolean> {
  const session = await getCurrentUser();
  if (!session) return false;
  const user = await getUserById(session.id);
  return user?.role === "ADMIN";
}

/** Call first in admin-only routes: returns the 403 to send, or null when allowed. */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAdmin()) return null;
  return NextResponse.json({ success: false, error: "Only an admin can do this. Ask an admin." }, { status: 403 });
}
