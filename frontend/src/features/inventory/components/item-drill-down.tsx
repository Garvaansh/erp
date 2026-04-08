"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listActiveBatches } from "@/features/inventory/api";
import type { ActiveBatch, ItemDefinition } from "@/features/inventory/types";

type ItemDrillDownProps = {
  item: ItemDefinition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatArrivalDate(value: string | null): string {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(`${value}T00:00:00Z`);
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

export function ItemDrillDown({
  item,
  open,
  onOpenChange,
}: ItemDrillDownProps) {
  const [batches, setBatches] = useState<ActiveBatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBatches() {
      if (!open || !item) {
        setBatches([]);
        setErrorMessage(null);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const rows = await listActiveBatches(item.id);
        if (!cancelled) {
          setBatches(rows);
        }
      } catch (error) {
        if (!cancelled) {
          setBatches([]);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to load batch drill-down.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadBatches();

    return () => {
      cancelled = true;
    };
  }, [open, item]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {item ? `${item.name} Batch Drill-Down` : "Batch Drill-Down"}
          </DialogTitle>
          <DialogDescription>
            Physical coil lots for the selected raw material definition.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading batches...</p>
        ) : null}

        {errorMessage ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        {!isLoading && !errorMessage ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Code</TableHead>
                  <TableHead>Arrival Date</TableHead>
                  <TableHead className="text-right">Current Weight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length ? (
                  batches.map((batch) => (
                    <TableRow key={batch.batch_id}>
                      <TableCell>{batch.batch_code}</TableCell>
                      <TableCell>
                        {formatArrivalDate(batch.arrival_date)}
                      </TableCell>
                      <TableCell className="text-right">
                        {batch.current_weight}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-sm text-muted-foreground"
                    >
                      No active batches found for this item.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
