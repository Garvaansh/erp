"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useUsers } from "@/features/users/queries";
import {
  useChangeUserPassword,
  useCreateUser,
  useUpdateUser,
} from "@/features/users/mutations";
import type { UserFilter, UserListItem, UserRole } from "@/features/users/types";

const ROLES: UserRole[] = ["ADMIN", "MANAGER", "STAFF"];

function roleLabel(role: UserRole): string {
  if (role === "ADMIN") return "Administrator";
  if (role === "MANAGER") return "Manager";
  return "Staff";
}

function statusLabel(isActive: boolean): string {
  return isActive ? "Active" : "Archived";
}

export function UsersView() {
  const [filter, setFilter] = useState<UserFilter>("active");
  const [searchInput, setSearchInput] = useState("");
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [creating, setCreating] = useState(false);
  const debouncedSearch = useDebounce(searchInput, 300);

  const usersQuery = useUsers(filter, debouncedSearch);
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const resetPasswordMutation = useChangeUserPassword();

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const totals = useMemo(() => {
    const active = users.filter((u) => u.is_active).length;
    const admins = users.filter((u) => u.role_code === "ADMIN").length;
    return { active, admins };
  }, [users]);

  function onCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    createUserMutation.mutate(
      {
        email: String(formData.get("email") ?? "").trim(),
        password: String(formData.get("password") ?? ""),
        role_code: String(formData.get("role_code") ?? "STAFF") as UserRole,
      },
      { onSuccess: () => setCreating(false) },
    );
  }

  function onEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) return;
    const formData = new FormData(event.currentTarget);
    updateUserMutation.mutate(
      {
        userId: editingUser.id,
        payload: {
          role_code: String(formData.get("role_code") ?? editingUser.role_code) as UserRole,
          is_active: formData.get("is_active") === "on",
        },
      },
      { onSuccess: () => setEditingUser(null) },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">User Management</h1>
        <button className="rounded border px-3 py-1.5 text-sm" onClick={() => setCreating(true)} type="button">
          Create User
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded border p-3 text-sm">Total: {users.length}</div>
        <div className="rounded border p-3 text-sm">Active: {totals.active}</div>
        <div className="rounded border p-3 text-sm">Admins: {totals.admins}</div>
      </div>

      <div className="flex gap-2">
        <select value={filter} onChange={(e) => setFilter(e.target.value as UserFilter)} className="rounded border px-2 py-1.5 text-sm">
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name/email/role"
          className="w-full rounded border px-3 py-1.5 text-sm"
        />
      </div>

      {usersQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />Loading users...</div>
      ) : usersQuery.error ? (
        <p className="text-sm text-red-500">Failed to load users.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Email</th>
              <th className="py-2">Role</th>
              <th className="py-2">Status</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b">
                <td className="py-2">{user.email}</td>
                <td className="py-2">{roleLabel(user.role_code)}</td>
                <td className="py-2">{statusLabel(user.is_active)}</td>
                <td className="py-2 text-right">
                  <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => setEditingUser(user)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating ? (
        <form onSubmit={onCreateSubmit} className="space-y-2 rounded border p-3">
          <p className="text-sm font-medium">Create User</p>
          <input name="email" type="email" required className="w-full rounded border px-2 py-1.5 text-sm" placeholder="user@company.com" />
          <input name="password" type="password" required minLength={8} className="w-full rounded border px-2 py-1.5 text-sm" placeholder="Password (min 8 chars)" />
          <select name="role_code" defaultValue="STAFF" className="w-full rounded border px-2 py-1.5 text-sm">
            {ROLES.map((role) => <option value={role} key={role}>{roleLabel(role)}</option>)}
          </select>
          <div className="flex gap-2">
            <button type="submit" className="rounded border px-3 py-1.5 text-sm" disabled={createUserMutation.isPending}>Save</button>
            <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </form>
      ) : null}

      {editingUser ? (
        <form onSubmit={onEditSubmit} className="space-y-2 rounded border p-3">
          <p className="text-sm font-medium">Edit User: {editingUser.email}</p>
          <select name="role_code" defaultValue={editingUser.role_code} className="w-full rounded border px-2 py-1.5 text-sm">
            {ROLES.map((role) => <option value={role} key={role}>{roleLabel(role)}</option>)}
          </select>
          <label className="inline-flex items-center gap-2 text-sm">
            <input name="is_active" type="checkbox" defaultChecked={editingUser.is_active} />
            Active
          </label>
          <div className="flex gap-2">
            <button type="submit" className="rounded border px-3 py-1.5 text-sm" disabled={updateUserMutation.isPending}>Update</button>
            <button
              type="button"
              className="rounded border px-3 py-1.5 text-sm"
              disabled={resetPasswordMutation.isPending}
              onClick={() => {
                const nextPassword = window.prompt("Enter new password (min 8 chars)");
                if (!nextPassword || nextPassword.trim().length < 8) return;
                resetPasswordMutation.mutate({ userId: editingUser.id, payload: { password: nextPassword } });
              }}
            >
              Reset Password
            </button>
            <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => setEditingUser(null)}>Close</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
