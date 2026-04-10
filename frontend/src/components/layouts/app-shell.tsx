"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PackageSearch,
  ClipboardList,
  Landmark,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  { href: "/procurement", label: "Procurement", icon: Truck },
  { href: "/inventory", label: "Inventory", icon: PackageSearch },
  { href: "/finance", label: "Finance", icon: Landmark },
  { href: "/logs", label: "Logs", icon: ClipboardList },
];

function isWorkspacePath(pathname: string): boolean {
  return NAV_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const showShell = useMemo(() => isWorkspacePath(pathname), [pathname]);

  if (!showShell) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-full bg-muted/30">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-4 px-4 py-4 md:px-6 lg:px-8">
        <div className="fixed right-0 bottom-0 left-0 z-40 border-t border-border/70 bg-background/95 px-4 py-2 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Button
                  key={`mobile-${item.href}`}
                  type="button"
                  variant={active ? "default" : "outline"}
                  size="sm"
                  className="shrink-0"
                  onClick={() => router.push(item.href)}
                >
                  <Icon className="mr-1 size-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </div>

        <aside className="hidden w-64 shrink-0 md:block">
          <Card className="sticky top-4 border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">Reva ERP</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {NAV_ITEMS.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <Button
                    key={item.href}
                    type="button"
                    variant={active ? "default" : "outline"}
                    className="w-full justify-start"
                    onClick={() => router.push(item.href)}
                  >
                    <Icon className="mr-2 size-4" />
                    {item.label}
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        </aside>

        <main className="min-w-0 flex-1 pb-16 md:pb-0">{children}</main>
      </div>
    </div>
  );
}
