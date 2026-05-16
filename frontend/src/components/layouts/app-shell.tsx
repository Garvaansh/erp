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
  Settings,
  Factory,
} from "lucide-react";
import { logout } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/auth.store";

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
      { href: "/production/wip", label: "Production", icon: Factory },
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
      className={`group relative flex w-full items-center gap-3 rounded-full border px-4 py-2 text-[14px] transition-colors ${
        active
          ? "border-white/10 bg-white/10 text-white font-medium"
          : "border-transparent text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
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
      <div className="flex items-center gap-3 px-6 h-14 shrink-0 border-b border-white/10">
        <div className="flex size-8 items-center justify-center rounded-full bg-white text-primary">
          <span className="text-xs font-bold">R</span>
        </div>
        <span className="text-sm font-semibold text-white tracking-tight">
          Reva ERP
        </span>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-4 pt-6 pb-3">
        {NAV_SECTIONS.map((section, i) => (
          <div key={section.title} className={i > 0 ? "mt-7" : ""}>
            <p className="px-4 mb-2 text-caption text-white/50 uppercase tracking-[0.18em]">
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
      <div className="border-t border-white/10 px-4 py-4 space-y-2">
        <button
          type="button"
          onClick={() => onNav("/settings")}
          className={`group relative flex w-full items-center gap-3 rounded-full border px-4 py-2 text-[14px] transition-colors ${
            pathname === "/settings"
              ? "border-white/10 bg-white/10 text-white font-medium"
              : "border-transparent text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Settings className="size-4 shrink-0" />
          Settings
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="group flex w-full items-center gap-3 rounded-full border border-transparent px-4 py-2 text-[14px] text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="size-4 shrink-0" />
          Sign Out
        </button>

        {/* Mini user card */}
        <div className="flex items-center gap-3 rounded-[12px] border border-white/10 bg-white/5 px-4 py-3 mt-2">
          <div className="size-8 rounded-full bg-white text-primary flex items-center justify-center text-[11px] font-bold shrink-0">
            {userInitial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-none truncate">
              {user?.email?.split("@")[0] || "User"}
            </p>
            <p className="text-[12px] text-white/60 capitalize mt-1">
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
      <aside className="hidden md:flex md:w-[248px] lg:w-[272px] flex-col shrink-0 border-r border-white/10 hero-band text-white">
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
          <aside className="absolute left-0 top-0 bottom-0 w-[288px] hero-band text-white border-r border-white/10 flex flex-col shadow-2xl">
            <div className="absolute right-3 top-3 z-10">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
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
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden bg-[#fbfbfb]">
        {/* Header */}
        <header className="flex items-center gap-4 bg-card/80 backdrop-blur-xl border-b border-border px-4 md:px-8 h-[72px] shrink-0 sticky top-0 z-30 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          {/* Mobile menu */}
          <button
            type="button"
            className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50 transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-4" />
          </button>

          {/* Page title */}
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 rounded-full bg-primary/80" />
            <h1 className="text-headline text-foreground">{pageTitle}</h1>
          </div>

          <div className="flex-1" />
        </header>

        {/* Page content with max-width constraint */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1280px] mx-auto p-5 md:p-8 lg:p-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
