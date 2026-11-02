import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserById, getUserByEmail, updateUser, deleteUser, getUsers } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { UserRole } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const user = await getUserById(id);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const { password_hash, ...sanitized } = user;

    return NextResponse.json({
      success: true,
      data: sanitized,
    });
  } catch (error) {
    console.error("GET /api/users/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve user" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const existing = await getUserById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Role check: Only ADMIN can edit users (or self updating name/password)
    const isSelf = currentUser.id === id;
    if (currentUser.role !== "ADMIN" && !isSelf) {
      return NextResponse.json(
        { success: false, error: "Forbidden. Administrator role required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, email, password, role } = body;

    // Only ADMIN can change someone's role
    if (role && role !== existing.role && currentUser.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Only administrators can change account roles." },
        { status: 403 }
      );
    }

    // Safeguard: Cannot demote the last ADMIN in the system
    if (existing.role === "ADMIN" && role && role !== "ADMIN") {
      const allUsers = await getUsers();
      const adminCount = allUsers.filter((u) => u.role === "ADMIN").length;
      if (adminCount <= 1) {
        return NextResponse.json(
          { success: false, error: "Cannot demote the only remaining Administrator." },
          { status: 400 }
        );
      }
    }

    // Email conflict check if email changed
    if (email && email.toLowerCase().trim() !== existing.email.toLowerCase().trim()) {
      const emailConflict = await getUserByEmail(email);
      if (emailConflict && emailConflict.id !== id) {
        return NextResponse.json(
          { success: false, error: "A user with this email address already exists." },
          { status: 409 }
        );
      }
    }

    if (password && password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const validRoles: UserRole[] = ["ADMIN", "SUPPORT_ENGINEER"];
    const targetRole = role && validRoles.includes(role) ? role : existing.role;

    const updatedUser = await updateUser(id, {
      name: name ? name.trim() : undefined,
      email: email ? email.toLowerCase().trim() : undefined,
      password: password && password.trim() ? password.trim() : undefined,
      role: targetRole,
    });

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: "Failed to update user." },
        { status: 500 }
      );
    }

    // Log to Audit Trail
    await logAuditEvent({
      user_id: currentUser.id,
      user_email: currentUser.email,
      action: "UPDATE_USER",
      resource_type: "USER",
      resource_id: id,
      details: `Updated staff user ${updatedUser.name} (${updatedUser.email}) - Role: ${updatedUser.role}${password ? " (Password reset)" : ""}`,
      ip_address: request.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    const { password_hash, ...sanitized } = updatedUser;

    return NextResponse.json({
      success: true,
      message: "Staff member updated successfully",
      data: sanitized,
    });
  } catch (error) {
    console.error("PUT /api/users/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Role check: Only ADMIN can delete staff users
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Forbidden. Administrator role required to delete users." },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Safeguard 1: Cannot delete self
    if (currentUser.id === id) {
      return NextResponse.json(
        { success: false, error: "You cannot delete your own active administrator account." },
        { status: 400 }
      );
    }

    const existing = await getUserById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Safeguard 2: Cannot delete the last remaining ADMIN
    if (existing.role === "ADMIN") {
      const allUsers = await getUsers();
      const adminCount = allUsers.filter((u) => u.role === "ADMIN").length;
      if (adminCount <= 1) {
        return NextResponse.json(
          { success: false, error: "Cannot delete the only remaining Administrator." },
          { status: 400 }
        );
      }
    }

    const deleted = await deleteUser(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Failed to delete user." },
        { status: 500 }
      );
    }

    // Log to Audit Trail
    await logAuditEvent({
      user_id: currentUser.id,
      user_email: currentUser.email,
      action: "DELETE_USER",
      resource_type: "USER",
      resource_id: id,
      details: `Deleted staff user account: ${existing.name} (${existing.email}) - Role was ${existing.role}`,
      ip_address: request.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    return NextResponse.json({
      success: true,
      message: `User ${existing.name} deleted successfully.`,
    });
  } catch (error) {
    console.error("DELETE /api/users/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete user" },
      { status: 500 }
    );
  }
}

