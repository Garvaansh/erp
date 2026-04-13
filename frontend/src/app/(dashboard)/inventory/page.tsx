"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { InventoryView } from "@/features/inventory/components/inventory-view";
import type { InventorySnapshot } from "@/features/inventory/types";
import { getInventorySnapshot } from "@/lib/api/inventory";
import { ApiClientError } from "@/lib/api/api-client";
import { inventoryKeys } from "@/lib/react-query/keys";
import { useAuthStore } from "@/stores/auth.store";

type InventoryTab = "raw" | "wip" | "finished";

function normalizeTab(value: string | null): InventoryTab {
  const tab = value ?? "";

  if (tab === "wip" || tab === "finished") {
    return tab;
  }

  return "raw";
}

export default function InventoryPage() {
  return (
    <Suspense fallback={null}>
      <InventoryPageContent />
    </Suspense>
  );
}

function InventoryPageContent() {
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);

  const initialTab = normalizeTab(
    searchParams.get("tab") ?? searchParams.get("lane"),
  );

  const emptySnapshot: InventorySnapshot = {
    RAW: [],
    SEMI_FINISHED: [],
    FINISHED: [],
    SCRAP: [],
  };

  const snapshotQuery = useQuery({
    queryKey: inventoryKeys.snapshot(),
    queryFn: getInventorySnapshot,
  });

  const serviceAlert = useMemo(() => {
    if (
      snapshotQuery.error instanceof ApiClientError &&
      snapshotQuery.error.statusCode >= 500
    ) {
      return "Inventory services are temporarily unavailable. Please verify backend API connectivity and retry.";
    }

    return undefined;
  }, [snapshotQuery.error]);

  if (snapshotQuery.error && !serviceAlert) {
    throw snapshotQuery.error;
  }

  const snapshot = snapshotQuery.data ?? emptySnapshot;
  const isAdmin = user?.is_admin === true;

  return (
    <InventoryView
      snapshot={snapshot}
      initialTab={initialTab}
      isAdmin={isAdmin}
      serviceAlert={serviceAlert}
    />
  );
}
