import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUsers, getUserByEmail, createUser } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { UserRole } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const role = searchParams.get("role") || undefined;

    const users = await getUsers({ search, role });

    return NextResponse.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error("GET /api/users error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve users" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Role check: Only ADMIN can create staff users
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Forbidden. Administrator role required to create staff users." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, email, password, role } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Staff member name is required." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "A valid email address is required." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const validRoles: UserRole[] = ["ADMIN", "SUPPORT_ENGINEER"];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: "Invalid role specified. Must be ADMIN or SUPPORT_ENGINEER." },
        { status: 400 }
      );
    }

    // Check for existing email conflict
    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { success: false, error: "A user with this email address already exists." },
        { status: 409 }
      );
    }

    const newUser = await createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim(),
      role: role as UserRole,
    });

    // Log to Audit Trail
    await logAuditEvent({
      user_id: currentUser.id,
      user_email: currentUser.email,
      action: "CREATE_USER",
      resource_type: "USER",
      resource_id: newUser.id,
      details: `Created new staff user: ${newUser.name} (${newUser.email}) with role ${newUser.role}`,
      ip_address: request.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    const { password_hash, ...sanitized } = newUser;

    return NextResponse.json(
      {
        success: true,
        message: "Staff member created successfully",
        data: sanitized,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/users error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create user account" },
      { status: 500 }
    );
  }
}

