"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRawMaterialBatches } from "@/lib/api/inventory";
import { inventoryKeys } from "@/lib/react-query/keys";
import type {
  RawMaterialBatchRow,
  BatchStatus,
} from "@/features/inventory/types";

type ItemDrillDownProps = {
  item: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatArrivalDate(value: string | null): string {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatKg(value: number): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)} kg`;
}

function batchStatusBadgeVariant(
  status: BatchStatus,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "HOLD":
      return "secondary";
    case "EXHAUSTED":
      return "outline";
    case "REVERSED":
      return "destructive";
    default:
      return "outline";
  }
}

export function ItemDrillDown({
  item,
  open,
  onOpenChange,
}: ItemDrillDownProps) {
  const activeItemID = open && item ? item.id : "";

  const batchesQuery = useQuery({
    queryKey: ["raw-material-batches", activeItemID],
    queryFn: () => getRawMaterialBatches(activeItemID),
    enabled: Boolean(activeItemID),
  });

  const batches: RawMaterialBatchRow[] = batchesQuery.data ?? [];
  const isLoading = batchesQuery.isFetching;
  const errorMessage =
    batchesQuery.error instanceof Error
      ? batchesQuery.error.message
      : batchesQuery.error
        ? "Failed to load batch drill-down."
        : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>
            {item ? `${item.name} Batches` : "Batch Details"}
          </SheetTitle>
          <SheetDescription>
            Physical coil lots and raw material batches currently available.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading batches...</p>
        ) : null}

        {errorMessage ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        {!isLoading && !errorMessage ? (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch ID</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">Initial Qty</TableHead>
                  <TableHead className="text-right">Available Qty</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length ? (
                  batches.map((batch) => (
                    <TableRow key={batch.batch_id}>
                      <TableCell className="font-mono text-xs">
                        {batch.batch_code || batch.batch_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        {formatArrivalDate(batch.received_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatKg(batch.initial_qty)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatKg(batch.remaining_qty)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={batchStatusBadgeVariant(batch.status)}
                        >
                          {batch.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      No active batches found for this item.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
