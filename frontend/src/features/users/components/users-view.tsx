"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Loader2, UserPlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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

function roleBadgeColor(role: UserRole): string {
  if (role === "ADMIN") return "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400";
  if (role === "MANAGER") return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
  return "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400";
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
        name: String(formData.get("name") ?? "").trim(),
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
          name: String(formData.get("name") ?? "").trim() || undefined,
          role_code: String(formData.get("role_code") ?? editingUser.role_code) as UserRole,
          is_active: formData.get("is_active") === "on",
        },
      },
      { onSuccess: () => setEditingUser(null) },
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with inline stats */}
      <div className="rounded-[16px] border border-border bg-card p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <h1 className="text-headline text-foreground">Users</h1>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-muted-foreground px-3 py-1 bg-muted rounded-full tabular-nums">
              {users.length} total
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 px-3 py-1 bg-emerald-100 dark:bg-emerald-500/15 rounded-full tabular-nums">
              {totals.active} active
            </span>
            <span className="text-xs text-violet-600 dark:text-violet-400 px-3 py-1 bg-violet-100 dark:bg-violet-500/15 rounded-full tabular-nums">
              {totals.admins} admins
            </span>
          </div>
        </div>
        <Button onClick={() => setCreating(true)} className="rounded-full shadow-md px-6">
          <UserPlus className="size-4 mr-2" />
          Create User
        </Button>
      </div>

      {/* Create User Form */}
      {creating && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-foreground">New User</h3>
          <form onSubmit={onCreateSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input name="name" type="text" className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="Full Name" />
              <input name="email" type="email" required className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="user@company.com" />
              <input name="password" type="password" required minLength={8} className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="Password (min 8)" />
              <select name="role_code" defaultValue="STAFF" className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20">
                {ROLES.map((role) => <option value={role} key={role}>{roleLabel(role)}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={createUserMutation.isPending}>Save</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      {/* Edit User Form */}
      {editingUser && (
        <div className="rounded-xl border border-primary/20 bg-card p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-foreground">
            Edit: <span className="text-muted-foreground font-normal">{editingUser.email}</span>
          </h3>
          <form onSubmit={onEditSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input name="name" type="text" defaultValue={editingUser.name} className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="Full Name" />
              <select name="role_code" defaultValue={editingUser.role_code} className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20">
                {ROLES.map((role) => <option value={role} key={role}>{roleLabel(role)}</option>)}
              </select>
              <label className="inline-flex items-center gap-2 text-sm text-foreground px-3 py-2">
                <input name="is_active" type="checkbox" defaultChecked={editingUser.is_active} className="accent-primary" />
                Active
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={updateUserMutation.isPending}>Update</Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={resetPasswordMutation.isPending}
                onClick={() => {
                  const nextPassword = window.prompt("Enter new password (min 8 chars)");
                  if (!nextPassword || nextPassword.trim().length < 8) return;
                  resetPasswordMutation.mutate({ userId: editingUser.id, payload: { password: nextPassword } });
                }}
              >
                Reset Password
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingUser(null)}>Close</Button>
            </div>
          </form>
        </div>
      )}

      {/* Table card */}
      {/* Table card */}
      <div className="rounded-[16px] border border-border bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search users…"
              className="w-full rounded-full border border-border pl-10 pr-3 py-1.5 text-sm bg-card/50 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as UserFilter)}
            className="rounded-full border border-border px-3 py-1.5 text-sm bg-background text-foreground outline-none focus:border-primary"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </div>

        {/* Table */}
        {usersQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
            <Loader2 className="size-4 animate-spin" />
            Loading users…
          </div>
        ) : usersQuery.error ? (
          <p className="text-sm text-destructive py-12 text-center">Failed to load users.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="py-2.5 px-4 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="py-2.5 px-4 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="py-2.5 px-4 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                <th className="py-2.5 px-4 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="py-2.5 px-4 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-4 text-[13px] text-foreground font-medium">{user.name}</td>
                  <td className="py-2.5 px-4 text-[13px] text-muted-foreground">{user.email}</td>
                  <td className="py-2.5 px-4">
                    <span className={`inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full ${roleBadgeColor(user.role_code)}`}>
                      {roleLabel(user.role_code)}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="inline-flex items-center gap-1.5 text-[13px]">
                      <span className={`size-1.5 rounded-full ${user.is_active ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                      <span className={user.is_active ? "text-foreground" : "text-muted-foreground"}>
                        {user.is_active ? "Active" : "Archived"}
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <Button variant="outline" size="sm" className="rounded-full shadow-sm" onClick={() => setEditingUser(user)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
