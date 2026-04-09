import {
  getInventorySnapshot,
  getRawItemDefinitions,
  getSelectableRawItems,
} from "@/features/inventory/api";
import { InventoryView } from "@/features/inventory/components/inventory-view";
import type {
  InventorySnapshot,
  ItemDefinition,
  SelectableItem,
} from "@/features/inventory/types";
import { ApiClientError } from "@/lib/api-client";

export const dynamic = "force-dynamic";

type InventoryTab = "raw" | "wip" | "finished";

type InventoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeTab(value: string | string[] | undefined): InventoryTab {
  const tab = Array.isArray(value) ? value[0] : value;

  if (tab === "wip" || tab === "finished") {
    return tab;
  }

  return "raw";
}

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialTab = normalizeTab(
    resolvedSearchParams?.tab ?? resolvedSearchParams?.lane,
  );

  const emptySnapshot: InventorySnapshot = {
    RAW: [],
    SEMI_FINISHED: [],
    FINISHED: [],
    SCRAP: [],
  };

  let snapshot: InventorySnapshot = emptySnapshot;
  let selectableItems: SelectableItem[] = [];
  let rawItems: ItemDefinition[] = [];
  let serviceAlert: string | undefined;

  try {
    [snapshot, selectableItems, rawItems] = await Promise.all([
      getInventorySnapshot(),
      getSelectableRawItems(),
      getRawItemDefinitions(),
    ]);
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode >= 500) {
      serviceAlert =
        "Inventory services are temporarily unavailable. Please verify backend API connectivity and retry.";
    } else {
      throw error;
    }
  }

  return (
    <InventoryView
      snapshot={snapshot}
      selectableItems={selectableItems}
      rawItems={rawItems}
      initialTab={initialTab}
      serviceAlert={serviceAlert}
    />
  );
}
