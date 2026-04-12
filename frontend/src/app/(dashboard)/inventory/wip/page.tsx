"use client";

import { useQuery } from "@tanstack/react-query";
import { WIPProductionPage } from "@/features/wip/components/wip-production-page";
import { getCurrentUser } from "@/lib/api/auth";
import { authKeys } from "@/lib/react-query/keys";

export default function InventoryWIPPage() {
  const meQuery = useQuery({
    queryKey: authKeys.me(),
    queryFn: getCurrentUser,
  });

  const isAdmin = meQuery.data?.is_admin === true;

  return <WIPProductionPage isAdmin={isAdmin} />;
}
