"use client";

import { WIPProductionPage } from "@/features/wip/components/wip-production-page";
import { useAuthStore } from "@/stores/auth.store";

export default function InventoryWIPPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.is_admin === true;

  return <WIPProductionPage isAdmin={isAdmin} />;
}
