"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { LogOut, Shield, Mail, Hash, CheckCircle } from "lucide-react";
import { logout } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";

function roleLabel(role: string): string {
  switch (role?.toUpperCase()) {
    case "ADMIN":
      return "Administrator";
    case "MANAGER":
      return "Manager";
    case "STAFF":
      return "Staff";
    default:
      return role || "Unknown";
  }
}

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const clearAuthSession = useAuthStore((state) => state.clearAuthSession);

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      clearAuthSession();
      queryClient.clear();
      router.push("/login");
      router.refresh();
    },
  });

  const userInitial = user?.email?.charAt(0)?.toUpperCase() || "U";

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-lg font-semibold text-foreground">Account</h1>

      {/* Profile card */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Profile</h3>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-4 pb-5 border-b border-border">
            <div className="size-12 rounded-full bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center text-base font-semibold text-white shrink-0">
              {userInitial}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {user?.email || "Unknown user"}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <Shield className="size-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {roleLabel(user?.role_code || "")}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5">
            <div className="flex items-start gap-3">
              <Mail className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Email</p>
                <p className="text-[13px] text-foreground font-medium mt-0.5">
                  {user?.email || "—"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Role</p>
                <p className="text-[13px] text-foreground font-medium mt-0.5">
                  {roleLabel(user?.role_code || "")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Hash className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">User ID</p>
                <p className="text-[13px] text-foreground font-mono mt-0.5">
                  {user?.id || "—"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                <p className="text-[13px] text-foreground font-medium mt-0.5 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Active
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Session card */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Session</h3>
        </div>
        <div className="p-5 flex items-center justify-between gap-4">
          <p className="text-[13px] text-muted-foreground">
            End your current session and return to login.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!logoutMutation.isPending) {
                logoutMutation.mutate();
              }
            }}
            loading={logoutMutation.isPending}
            className="gap-2 shrink-0"
          >
            <LogOut className="size-3.5" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
