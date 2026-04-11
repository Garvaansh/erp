"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PackageSearch,
  ClipboardList,
  Landmark,
  Truck,
  Settings,
  LifeBuoy,
  LogOut,
  Search,
  Bell,
  Zap,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { logoutAction } from "@/features/auth/actions";

type AppShellProps = {
  children: React.ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: PackageSearch },
  { href: "/procurement", label: "Procurement", icon: Truck },
  { href: "/finance", label: "Finance", icon: Landmark },
  { href: "/logs", label: "Logs", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings },
];

const BOTTOM_ITEMS: NavItem[] = [
  { href: "#support", label: "Support", icon: LifeBuoy },
  { href: "#logout", label: "Sign Out", icon: LogOut },
];

function isWorkspacePath(pathname: string): boolean {
  return NAV_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

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
      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-[var(--erp-accent-glow)] text-[var(--erp-accent-bright)] border-l-2 border-[var(--erp-accent)] -ml-[1px]"
          : "text-[var(--erp-text-secondary)] hover:bg-[var(--erp-accent-glow)] hover:text-[var(--erp-text-primary)]"
      }`}
    >
      <Icon
        className={`size-[18px] shrink-0 transition-colors ${
          active
            ? "text-[var(--erp-accent)]"
            : "text-[var(--erp-text-muted)] group-hover:text-[var(--erp-accent)]"
        }`}
      />
      {item.label}
    </button>
  );
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const showShell = useMemo(() => isWorkspacePath(pathname), [pathname]);

  if (!showShell) {
    return <>{children}</>;
  }

  const handleNav = (href: string) => {
    if (href === "#logout") {
      logoutAction().then(() => {
        router.push("/login");
        router.refresh();
      });
      return;
    }
    if (href.startsWith("#")) return;
    router.push(href);
    setMobileOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--erp-bg-deep)]">
      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden md:flex md:w-[220px] lg:w-[240px] flex-col shrink-0 border-r border-[var(--erp-border-subtle)] bg-[var(--sidebar)]">
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[var(--erp-border-subtle)]">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--erp-accent)] to-cyan-600 shadow-lg shadow-cyan-500/20">
            <Zap className="size-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--erp-text-primary)] tracking-wide">
              Reva ERP
            </p>
            <p className="text-[10px] font-medium text-[var(--erp-text-muted)] uppercase tracking-widest">
              v2.4.0 PRO
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <SidebarNavItem
                key={item.href}
                item={item}
                active={active}
                onClick={() => handleNav(item.href)}
              />
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-[var(--erp-border-subtle)] px-3 py-3 space-y-1">
          {BOTTOM_ITEMS.map((item) => (
            <SidebarNavItem
              key={item.href}
              item={item}
              active={false}
              onClick={() => handleNav(item.href)}
            />
          ))}
        </div>
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[260px] bg-[var(--sidebar)] border-r border-[var(--erp-border-subtle)] flex flex-col erp-slide-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--erp-border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--erp-accent)] to-cyan-600">
                  <Zap className="size-4 text-white" />
                </div>
                <p className="text-sm font-bold text-[var(--erp-text-primary)]">
                  Reva ERP
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1 text-[var(--erp-text-muted)] hover:text-[var(--erp-text-primary)]"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarNavItem
                    key={item.href}
                    item={item}
                    active={active}
                    onClick={() => handleNav(item.href)}
                  />
                );
              })}
            </nav>
            <div className="border-t border-[var(--erp-border-subtle)] px-3 py-3 space-y-1">
              {BOTTOM_ITEMS.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  item={item}
                  active={false}
                  onClick={() => handleNav(item.href)}
                />
              ))}
            </div>
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="flex items-center gap-4 border-b border-[var(--erp-border-subtle)] bg-[var(--sidebar)] px-4 md:px-6 h-14 shrink-0">
          {/* Mobile menu */}
          <button
            type="button"
            className="md:hidden p-1.5 text-[var(--erp-text-muted)] hover:text-[var(--erp-text-primary)]"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </button>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-1.5 focus-within:border-[var(--erp-accent)] transition-colors">
              <Search className="size-4 text-[var(--erp-text-muted)]" />
              <input
                type="text"
                placeholder="Search factory assets, serials, or orders..."
                className="flex-1 bg-transparent text-sm text-[var(--erp-text-primary)] placeholder:text-[var(--erp-text-muted)] outline-none"
              />
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="hidden lg:flex items-center gap-1 text-xs text-[var(--erp-text-muted)]">
            <span>ERP Command Center</span>
            <ChevronRight className="size-3" />
            <span className="text-[var(--erp-text-secondary)] capitalize">
              {pathname.split("/").filter(Boolean)[0] || "dashboard"}
            </span>
          </div>

          <div className="flex-1" />

          {/* Right actions */}
          <button
            type="button"
            className="hidden sm:flex items-center gap-2 rounded-lg bg-[var(--erp-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] hover:bg-[var(--erp-accent-bright)] transition-colors"
          >
            <Zap className="size-3.5" />
            Quick Action
          </button>
          <button
            type="button"
            className="relative p-2 text-[var(--erp-text-muted)] hover:text-[var(--erp-text-primary)] transition-colors"
          >
            <Bell className="size-[18px]" />
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[var(--erp-accent)]" />
          </button>
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-[var(--erp-border-subtle)]">
            <div className="size-8 rounded-full bg-gradient-to-br from-[var(--erp-accent)] to-teal-600 flex items-center justify-center text-xs font-bold text-white">
              A
            </div>
            <div className="hidden md:block">
              <p className="text-xs font-medium text-[var(--erp-text-primary)]">
                Admin
              </p>
              <p className="text-[10px] text-[var(--erp-text-muted)]">
                SUPER ADMIN
              </p>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
