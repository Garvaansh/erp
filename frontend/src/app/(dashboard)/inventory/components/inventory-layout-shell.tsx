"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type InventoryLayoutShellProps = {
  children: ReactNode;
};

const INVENTORY_TABS = [
  {
    key: "raw-materials",
    label: "Raw Materials",
    href: "/inventory/raw-materials",
  },
  {
    key: "finished-goods",
    label: "Finished Goods",
    href: "/inventory/finished-goods",
  },
] as const;

export type InventoryTabKey = (typeof INVENTORY_TABS)[number]["key"];

export function resolveInventoryTab(pathname: string): InventoryTabKey {
  if (pathname.startsWith("/inventory/finished-goods")) {
    return "finished-goods";
  }

  return "raw-materials";
}

export function InventoryLayoutShell({
  children,
}: InventoryLayoutShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = resolveInventoryTab(pathname);

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          Stock control for procurement receipts and finished-goods availability.
        </p>
      </header>

      <nav
        aria-label="Inventory sections"
        className="flex flex-wrap gap-2 border-b border-border pb-3"
      >
        {INVENTORY_TABS.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <Button
              key={tab.key}
              type="button"
              variant={isActive ? "default" : "outline"}
              onClick={() => router.push(tab.href)}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.label}
            </Button>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}
