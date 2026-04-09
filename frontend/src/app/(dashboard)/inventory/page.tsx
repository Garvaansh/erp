import {
  getInventorySnapshot,
  getRawItemDefinitions,
  getSelectableRawItems,
} from "@/features/inventory/api";
import { InventoryView } from "@/features/inventory/components/inventory-view";

export const dynamic = "force-dynamic";

type LaneTab = "raw" | "wip" | "finished";

type InventoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeLane(value: string | string[] | undefined): LaneTab {
  const lane = Array.isArray(value) ? value[0] : value;

  if (lane === "wip" || lane === "finished") {
    return lane;
  }

  return "raw";
}

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialLane = normalizeLane(resolvedSearchParams?.lane);

  const [snapshot, selectableItems, rawItems] = await Promise.all([
    getInventorySnapshot(),
    getSelectableRawItems(),
    getRawItemDefinitions(),
  ]);

  return (
    <InventoryView
      snapshot={snapshot}
      selectableItems={selectableItems}
      rawItems={rawItems}
      initialLane={initialLane}
    />
  );
}
