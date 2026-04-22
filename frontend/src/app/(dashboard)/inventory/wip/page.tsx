"use client";

import { WIPProductionPage } from "@/features/wip/components/wip-production-page";
import { useAuthStore } from "@/stores/auth.store";

export default function InventoryWIPPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role_code === "ADMIN";

  return <WIPProductionPage isAdmin={isAdmin} />;
}
