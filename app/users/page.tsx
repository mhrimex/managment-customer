"use client";

import ModalShell from "@/components/ModalShell";
import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  ShieldCheck,
  UserCheck,
  Plus,
  Search,
  Edit3,
  Trash2,
  KeyRound,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  User as UserIcon,
  Mail,
  Calendar,
  Lock
} from "lucide-react";
import { User, SessionUser, UserRole } from "@/types";
import UserModal from "@/components/UserModal";
import { SkeletonRows } from "@/components/Skeleton";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast / feedback state
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Fetch current session
  const fetchSession = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
      }
    } catch {
      // ignore
    }
  };

  // Fetch users list
  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (roleFilter !== "ALL") params.set("role", roleFilter);

      const res = await fetch(`/api/users?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data || []);
      } else {
        showToast("error", data.error || "Failed to load users list");
      }
    } catch (err: any) {
      showToast("error", "Network error while loading staff members");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSession();
    fetchUsers();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const handleOpenCreate = () => {
    setUserToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setUserToEdit(user);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/users/${userToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete user");
      }

      showToast("success", data.message || `Deleted ${userToDelete.name}`);
      setUserToDelete(null);
      fetchUsers();
    } catch (err: any) {
      showToast("error", err.message || "Failed to delete user account");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered users for instant local search
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !searchQuery ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = roleFilter === "ALL" || u.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  // Statistics
  const adminCount = users.filter((u) => u.role === "ADMIN").length;
  const supportCount = users.filter((u) => u.role === "SUPPORT_ENGINEER").length;
  const isAdmin = currentUser?.role === "ADMIN";

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto select-none">
      {/* Toast Alert */}
      {feedback && (
        <div
          className={`fixed top-5 right-5 z-50 p-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-top-5 duration-200 ${
            feedback.type === "success"
              ? "bg-slate-900 border-emerald-500/40 text-emerald-300"
              : "bg-slate-900 border-rose-500/40 text-rose-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-semibold">{feedback.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/15 text-indigo-400 border border-indigo-500/20">
              <Users size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Staff & User Management
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Manage agency administrators, support engineers, and access permissions
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Refresh Users"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin text-indigo-400" : ""} />
          </button>

          {isAdmin ? (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <Plus size={16} />
              <span>Add Staff Member</span>
            </button>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-amber-400" />
              <span>Read-Only (Support Role)</span>
            </div>
          )}
        </div>
      </div>

      {/* Non-admin notice */}
      {!isAdmin && currentUser && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-3">
          <ShieldAlert size={16} className="shrink-0 text-amber-400" />
          <span>
            You are logged in as <strong>{currentUser.name}</strong> (Support Engineer). Account creation, role editing, and deletions require <strong>Administrator</strong> privileges.
          </span>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Staff */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Staff Accounts</span>
            <div className="p-2 rounded-xl bg-slate-800/80 text-slate-300">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-white">{users.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Agency team members</p>
        </div>

        {/* Administrators */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Administrators</span>
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-indigo-300">{adminCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Full system privilege</p>
        </div>

        {/* Support Engineers */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Support Engineers</span>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
              <UserCheck size={16} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-emerald-300">{supportCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Operational inspection</p>
        </div>

        {/* Current User Session */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Your Active Session</span>
            <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400">
              <KeyRound size={16} />
            </div>
          </div>
          <div className="mt-3 text-sm font-bold text-white truncate">
            {currentUser?.name || "Loading..."}
          </div>
          <div className="text-[11px] font-mono text-indigo-400 font-semibold mt-1">
            {currentUser?.role || "..."}
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 glass-panel flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff by name or email..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-400 shrink-0">Filter Role:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Roles ({users.length})</option>
            <option value="ADMIN">Administrators ({adminCount})</option>
            <option value="SUPPORT_ENGINEER">Support Engineers ({supportCount})</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl glass-panel">
        <div className="overflow-x-auto">
          <table className="rtable w-full text-left text-sm">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Staff Member</th>
                <th className="py-3.5 px-4">Role & Access</th>
                <th className="py-3.5 px-4">Account Status</th>
                <th className="py-3.5 px-4">Provisioned Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading && filteredUsers.length === 0 ? (
                <SkeletonRows rows={4} cols={5} />
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Users size={28} className="mx-auto mb-2 text-slate-600" />
                    <p className="font-semibold text-slate-300">No staff members found</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {searchQuery
                        ? "Try adjusting your search criteria"
                        : "Click '+ Add Staff Member' to provision a new user"}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrent = currentUser?.id === user.id;

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Name & Email */}
                      <td data-primary className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-700/80 flex items-center justify-center text-slate-200 font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                            {user.name
                              ? user.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join("")
                                  .toUpperCase()
                              : "U"}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white text-xs flex items-center gap-1.5 truncate">
                              <span>{user.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td data-label="Role" className="py-3.5 px-4">
                        {user.role === "ADMIN" ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold">
                            <ShieldCheck size={14} className="text-indigo-400" />
                            <span>Administrator</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
                            <UserCheck size={14} className="text-emerald-400" />
                            <span>Support Engineer</span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td data-label="Status" className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Active</span>
                        </span>
                      </td>

                      {/* Created Date */}
                      <td data-label="Created" className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "Default Seed"}
                      </td>

                      {/* Actions */}
                      <td data-label="Actions" className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdmin ? (
                            <>
                              <button
                                onClick={() => handleOpenEdit(user)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                title="Edit Role or Credentials"
                              >
                                <Edit3 size={15} />
                              </button>

                              <button
                                onClick={() => setUserToDelete(user)}
                                disabled={isCurrent || (user.role === "ADMIN" && adminCount <= 1)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                                title={
                                  isCurrent
                                    ? "Cannot delete your own account"
                                    : user.role === "ADMIN" && adminCount <= 1
                                    ? "Cannot delete the only remaining Administrator"
                                    : "Delete Account"
                                }
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Protected</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <ModalShell onClose={() => setUserToDelete(null)} busy={isDeleting} size="sm">
          <div className="overflow-y-auto overscroll-contain min-h-0 p-5 sm:p-7 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-7 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Staff Account</h3>
                <p className="text-xs text-slate-400">This action is permanent and recorded in audit trail</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete the staff account for{" "}
              <strong className="text-white">{userToDelete.name}</strong> (
              <span className="font-mono text-indigo-300">{userToDelete.email}</span>)?
              They will immediately lose access to the management console.
            </p>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold shadow-md shadow-rose-600/30 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                <span>{isDeleting ? "Deleting..." : "Confirm Deletion"}</span>
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* User Create / Edit Modal */}
      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userToEdit={userToEdit}
        onSuccess={(savedUser) => {
          showToast(
            "success",
            userToEdit
              ? `Updated account for ${savedUser?.name}`
              : `Created new staff account for ${savedUser?.name}`
          );
          fetchUsers();
        }}
      />
    </div>
  );
}

