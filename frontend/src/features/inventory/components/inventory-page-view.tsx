import { InventorySnapshotCard } from "@/features/inventory/components/inventory-snapshot-card";
import { ReceiveStockForm } from "@/features/inventory/components/receive-stock-form";
import type { InventorySnapshot } from "@/features/inventory/types";

type InventoryPageViewProps = {
  snapshot: InventorySnapshot;
};

export function InventoryPageView({ snapshot }: InventoryPageViewProps) {
  return (
    <div className="space-y-4">
      <InventorySnapshotCard snapshot={snapshot} />
      <ReceiveStockForm />
    </div>
  );
}
