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
    key: "wip",
    label: "WIP",
    href: "/inventory/wip",
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

  if (pathname.startsWith("/inventory/wip")) {
    return "wip";
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
      <header className="space-y-2 mb-6">
        <h1 className="text-headline text-foreground">Inventory</h1>
        <p className="text-body-lg text-muted-foreground">
          Operational stock control across raw material, WIP, and finished goods.
        </p>
      </header>

      <nav
        aria-label="Inventory sections"
        className="flex flex-wrap gap-2 border-b border-border pb-4"
      >
        {INVENTORY_TABS.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <Button
              key={tab.key}
              type="button"
              variant={isActive ? "default" : "outline"}
              className={`rounded-full px-5 ${isActive ? "shadow-md" : "hover:bg-muted"}`}
              onClick={() => router.push(tab.href)}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.label}
            </Button>
          );
        })}
      </nav>

      <div className="pt-2">{children}</div>
    </div>
  );
}
