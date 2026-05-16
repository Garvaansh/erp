import type { ReactNode } from "react";
import { InventoryLayoutShell } from "@/app/(dashboard)/inventory/components/inventory-layout-shell";

export default function InventoryLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <InventoryLayoutShell>{children}</InventoryLayoutShell>;
}
