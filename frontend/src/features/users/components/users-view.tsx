"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Mail,
  X,
  Search,
  Check,
  Ban,
  Pencil,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { getUsers, createUser, updateUser } from "@/features/users/api";
import type {
  UserListItem,
  UserRole,
  CreateUserPayload,
  UpdateUserPayload,
} from "@/features/users/types";
import { usersKeys } from "@/lib/react-query/keys";

function roleBadge(role: string, isAdmin: boolean) {
  if (isAdmin || role === "SUPER_ADMIN") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-400 ring-1 ring-purple-500/30">
        <ShieldCheck className="size-3" />
        {role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
      </span>
    );
  }
  if (role === "ADMIN") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-400 ring-1 ring-cyan-500/30">
        <Shield className="size-3" />
        Manager
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 ring-1 ring-slate-500/30">
      <ShieldAlert className="size-3" />
      Staff
    </span>
  );
}

function statusBadge(isActive: boolean) {
  return isActive ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
      <Check className="size-3" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400 ring-1 ring-red-500/30">
      <Ban className="size-3" />
      Inactive
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Create User Form (Slideout) ────────────────────────────────────

function CreateUserSlideout({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.list() });
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to create user");
    },
  });

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const roleCode = String(fd.get("role_code") ?? "WORKER") as UserRole;
    const isAdmin = roleCode === "SUPER_ADMIN";

    if (!name || !email || !password) {
      setError("All fields are required.");
      return;
    }

    mutation.mutate({
      name,
      email,
      password,
      role_code: roleCode,
      is_admin: isAdmin,
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-[var(--sidebar)] border-l border-[var(--erp-border-subtle)] shadow-2xl erp-slide-in overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--erp-border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--erp-accent-glow)] text-[var(--erp-accent)]">
              <UserPlus className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--erp-text-primary)]">
                New User
              </h2>
              <p className="text-[10px] text-[var(--erp-text-muted)]">
                Add a team member to the system
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--erp-text-muted)] hover:text-[var(--erp-text-primary)] transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[var(--erp-text-secondary)] mb-1.5">
              Full Name
            </label>
            <input
              name="name"
              type="text"
              required
              placeholder="e.g. Rajesh Kumar"
              className="w-full rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-2.5 text-sm text-[var(--erp-text-primary)] placeholder:text-[var(--erp-text-muted)] outline-none focus:border-[var(--erp-accent)] transition-colors"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-[var(--erp-text-secondary)] mb-1.5">
              Email Address
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-2.5 focus-within:border-[var(--erp-accent)] transition-colors">
              <Mail className="size-4 text-[var(--erp-text-muted)] shrink-0" />
              <input
                name="email"
                type="email"
                required
                placeholder="user@revatech.com"
                className="flex-1 bg-transparent text-sm text-[var(--erp-text-primary)] placeholder:text-[var(--erp-text-muted)] outline-none"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-[var(--erp-text-secondary)] mb-1.5">
              Initial Password
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="Min 6 characters"
              className="w-full rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-2.5 text-sm text-[var(--erp-text-primary)] placeholder:text-[var(--erp-text-muted)] outline-none focus:border-[var(--erp-accent)] transition-colors"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-medium text-[var(--erp-text-secondary)] mb-1.5">
              System Role
            </label>
            <div className="relative">
              <select
                name="role_code"
                defaultValue="WORKER"
                className="w-full appearance-none rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-2.5 pr-8 text-sm text-[var(--erp-text-primary)] outline-none focus:border-[var(--erp-accent)] transition-colors"
              >
                <option value="WORKER">Staff (Limited Access)</option>
                <option value="ADMIN">Manager (Can Approve POs)</option>
                <option value="SUPER_ADMIN">Administrator (Full Access)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[var(--erp-text-muted)] pointer-events-none" />
            </div>
          </div>

          {/* Error */}
          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          ) : null}

          {/* Submit */}
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--erp-accent)] to-cyan-500 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white hover:from-[var(--erp-accent-bright)] hover:to-cyan-400 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-cyan-500/20"
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="size-4" />
                Create User
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Edit User Inline ──────────────────────────────────────────────

function EditUserRow({
  user,
  onDone,
}: {
  user: UserListItem;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const toggleActive = useMutation({
    mutationFn: (payload: UpdateUserPayload) => updateUser(user.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.list() });
      onDone();
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Update failed"),
  });

  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        type="button"
        disabled={toggleActive.isPending}
        onClick={() => toggleActive.mutate({ is_active: !user.is_active })}
        className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
          user.is_active
            ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
            : "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
        }`}
      >
        {user.is_active ? "Deactivate" : "Activate"}
      </button>
      <button
        type="button"
        onClick={onDone}
        className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-[var(--erp-bg-surface)] text-[var(--erp-text-muted)] hover:text-[var(--erp-text-primary)] transition-colors"
      >
        Cancel
      </button>
      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </div>
  );
}

// ─── Main View ─────────────────────────────────────────────────────

export function UsersView() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    data: users = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: usersKeys.list(),
    queryFn: getUsers,
    refetchOnWindowFocus: false,
  });

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role_code.toLowerCase().includes(search.toLowerCase()),
  );

  const totalActive = users.filter((u) => u.is_active).length;
  const totalAdmins = users.filter(
    (u) => u.is_admin || u.role_code === "SUPER_ADMIN",
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="erp-section-title mb-1">Access Control</p>
          <h1 className="text-2xl font-bold text-[var(--erp-text-primary)]">
            User Management
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--erp-accent)] to-cyan-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:from-[var(--erp-accent-bright)] hover:to-cyan-400 transition-all shadow-lg shadow-cyan-500/20"
        >
          <UserPlus className="size-3.5" />
          Add User
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="erp-card-static p-4 flex items-center gap-4">
          <Users className="size-5 text-[var(--erp-accent)]" />
          <div>
            <p className="erp-kpi-label">Total Users</p>
            <p className="text-xl font-bold text-[var(--erp-text-primary)] tabular-nums">
              {users.length}
            </p>
          </div>
        </div>
        <div className="erp-card-static p-4 flex items-center gap-4">
          <Check className="size-5 text-[var(--erp-success)]" />
          <div>
            <p className="erp-kpi-label">Active</p>
            <p className="text-xl font-bold text-[var(--erp-text-primary)] tabular-nums">
              {totalActive}
            </p>
          </div>
        </div>
        <div className="erp-card-static p-4 flex items-center gap-4">
          <ShieldCheck className="size-5 text-purple-400" />
          <div>
            <p className="erp-kpi-label">Administrators</p>
            <p className="text-xl font-bold text-[var(--erp-text-primary)] tabular-nums">
              {totalAdmins}
            </p>
          </div>
        </div>
      </div>

      {/* Search + Table */}
      <div className="erp-card-static overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[var(--erp-border-subtle)] p-4">
          <div className="flex-1 max-w-sm">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-1.5 focus-within:border-[var(--erp-accent)] transition-colors">
              <Search className="size-4 text-[var(--erp-text-muted)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or role..."
                className="flex-1 bg-transparent text-sm text-[var(--erp-text-primary)] placeholder:text-[var(--erp-text-muted)] outline-none"
              />
            </div>
          </div>
          <span className="text-xs text-[var(--erp-text-muted)]">
            {filtered.length} user{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 text-[var(--erp-accent)] animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-sm text-red-400">
            Failed to load users. Please try again.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Users className="size-10 text-[var(--erp-text-muted)]" />
            <p className="text-sm text-[var(--erp-text-muted)]">
              {search
                ? "No users match your search"
                : "No users registered yet"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="erp-table w-full">
              <thead>
                <tr>
                  <th className="erp-table-th text-left">User</th>
                  <th className="erp-table-th text-left">Role</th>
                  <th className="erp-table-th text-left">Status</th>
                  <th className="erp-table-th text-left">Joined</th>
                  <th className="erp-table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user, idx) => (
                  <tr
                    key={user.id}
                    className="erp-table-row erp-fade-in"
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <td className="erp-table-td">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--erp-accent)] to-teal-600 text-xs font-bold text-white shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--erp-text-primary)] truncate">
                            {user.name}
                          </p>
                          <p className="text-[10px] text-[var(--erp-text-muted)] truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="erp-table-td">
                      {roleBadge(user.role_code, user.is_admin)}
                    </td>
                    <td className="erp-table-td">
                      {statusBadge(user.is_active)}
                    </td>
                    <td className="erp-table-td">
                      <span className="text-xs text-[var(--erp-text-secondary)]">
                        {timeAgo(user.created_at)}
                      </span>
                    </td>
                    <td className="erp-table-td text-right">
                      {editingId === user.id ? (
                        <EditUserRow
                          user={user}
                          onDone={() => setEditingId(null)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingId(user.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-[var(--erp-bg-surface)] border border-[var(--erp-border-default)] px-2.5 py-1 text-[10px] font-semibold text-[var(--erp-text-secondary)] hover:border-[var(--erp-accent)] hover:text-[var(--erp-accent)] transition-colors"
                        >
                          <Pencil className="size-3" />
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Slideout */}
      <CreateUserSlideout
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </div>
  );
}
