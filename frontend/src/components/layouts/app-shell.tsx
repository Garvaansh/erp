"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  PackageSearch,
  Landmark,
  Truck,
  LogOut,
  Menu,
  X,
  Users,
  Building2,
  BarChart3,
  ClipboardList,
  Sun,
  Moon,
  Settings,
} from "lucide-react";
import { logout } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/components/theme-provider";

/* ── Types ────────────────────────────────────────────────────────── */

type AppShellProps = { children: React.ReactNode };

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

/* ── Navigation config ────────────────────────────────────────────── */

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/inventory", label: "Inventory", icon: PackageSearch },
      { href: "/procurement", label: "Procurement", icon: Truck },
      { href: "/procurement/vendors", label: "Vendors", icon: Building2 },
    ],
  },
  {
    title: "Management",
    items: [
      { href: "/users", label: "Users", icon: Users },
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/finance", label: "Finance", icon: Landmark },
      { href: "/logs", label: "Logs", icon: ClipboardList },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

function isWorkspacePath(pathname: string): boolean {
  return (
    ALL_NAV_ITEMS.some(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) || pathname === "/settings"
  );
}

/* ── Page title from route ────────────────────────────────────────── */

function getPageTitle(pathname: string): string {
  const match = ALL_NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (match) return match.label;
  if (pathname === "/settings") return "Settings";
  return "Dashboard";
}

/* ── Sidebar nav item ─────────────────────────────────────────────── */

function SidebarNavItem({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-[7px] text-[13px] transition-all duration-150 ${
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {/* Active indicator bar */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary" />
      )}
      <Icon className="size-4 shrink-0" />
      {item.label}
    </button>
  );
}

/* ── Sidebar content (shared between desktop and mobile) ──────────── */

function SidebarContent({
  pathname,
  onNav,
  onLogout,
  user,
}: {
  pathname: string;
  onNav: (href: string) => void;
  onLogout: () => void;
  user: { email?: string; role_code?: string } | null;
}) {
  const userInitial = user?.email?.charAt(0)?.toUpperCase() || "U";

  return (
    <>
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 h-12 shrink-0 border-b border-border">
        <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-violet-500 text-white shadow-sm shadow-primary/20">
          <span className="text-xs font-bold">R</span>
        </div>
        <span className="text-sm font-semibold text-foreground tracking-tight">
          Reva ERP
        </span>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-3 pt-4 pb-2">
        {NAV_SECTIONS.map((section, i) => (
          <div key={section.title} className={i > 0 ? "mt-6" : ""}>
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarNavItem
                    key={item.href}
                    item={item}
                    active={active}
                    onClick={() => onNav(item.href)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom user card */}
      <div className="border-t border-border px-3 py-3 space-y-1">
        <button
          type="button"
          onClick={() => onNav("/settings")}
          className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-[7px] text-[13px] transition-all duration-150 ${
            pathname === "/settings"
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {pathname === "/settings" && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary" />
          )}
          <Settings className="size-4 shrink-0" />
          Settings
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="group flex w-full items-center gap-3 rounded-lg px-3 py-[7px] text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150"
        >
          <LogOut className="size-4 shrink-0" />
          Sign Out
        </button>

        {/* Mini user card */}
        <div className="flex items-center gap-2.5 px-3 pt-2 mt-1 border-t border-border">
          <div className="size-7 rounded-full bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center text-[10px] font-semibold text-white shrink-0">
            {userInitial}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground leading-none truncate">
              {user?.email?.split("@")[0] || "User"}
            </p>
            <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
              {user?.role_code?.toLowerCase() || "staff"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Main AppShell ────────────────────────────────────────────────── */

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const clearAuthSession = useAuthStore((state) => state.clearAuthSession);
  const user = useAuthStore((state) => state.user);
  const { theme, toggleTheme } = useTheme();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      clearAuthSession();
      queryClient.clear();
      router.push("/login");
      router.refresh();
    },
  });

  const showShell = useMemo(() => isWorkspacePath(pathname), [pathname]);

  if (!showShell) {
    return <>{children}</>;
  }

  const handleNav = (href: string) => {
    router.push(href);
    setMobileOpen(false);
  };

  const handleLogout = () => {
    if (!logoutMutation.isPending) {
      logoutMutation.mutate();
    }
  };

  const pageTitle = getPageTitle(pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex md:w-[240px] lg:w-[260px] flex-col shrink-0 border-r border-border bg-card/50">
        <SidebarContent
          pathname={pathname}
          onNav={handleNav}
          onLogout={handleLogout}
          user={user}
        />
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[280px] bg-card border-r border-border flex flex-col shadow-2xl">
            <div className="absolute right-3 top-3 z-10">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
            <SidebarContent
              pathname={pathname}
              onNav={handleNav}
              onLogout={handleLogout}
              user={user}
            />
          </aside>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Compact header */}
        <header className="flex items-center gap-3 border-b border-border bg-card/50 px-4 md:px-6 h-12 shrink-0">
          {/* Mobile menu */}
          <button
            type="button"
            className="md:hidden p-1.5 -ml-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-4" />
          </button>

          {/* Page title */}
          <h1 className="text-sm font-semibold text-foreground">{pageTitle}</h1>

          <div className="flex-1" />

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={
              theme === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
          >
            {theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </button>
        </header>

        {/* Page content with max-width constraint */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
