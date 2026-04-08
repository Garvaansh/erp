import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InventorySnapshot } from "@/features/inventory/types";

type InventorySnapshotCardProps = {
  snapshot: InventorySnapshot;
};

export function InventorySnapshotCard({
  snapshot,
}: InventorySnapshotCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory Snapshot</CardTitle>
        <CardDescription>
          Current item availability grouped by inventory category.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
