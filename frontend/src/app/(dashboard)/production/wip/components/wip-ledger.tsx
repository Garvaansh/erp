"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { FlaskConical, Sparkles, LayoutList, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { MoldingDialog } from "@/app/(dashboard)/production/wip/components/molding-dialog";
import { PolishingDialog } from "@/app/(dashboard)/production/wip/components/polishing-dialog";
import { getWIPRuns } from "@/lib/api/wip";
import type { WIPProductionRun } from "@/app/(dashboard)/production/wip/types";
import { getBatchDetailHref } from "@/lib/inventory/batch-routing";
import { wipKeys } from "@/lib/react-query/keys";

const COL_COUNT = 12;

function outputBatchHref(run: WIPProductionRun): string {
  const stage = run.workstation || run.run_type;
  return getBatchDetailHref(
    stage === "POLISHING" ? "FINISHED" : "MOLDED",
    run.output_batch_code
  );
}

// ─── Yield formatter ─────────────────────────────────────────────────────────
function yieldPct(run: WIPProductionRun): string {
  if (!run.input_qty || run.input_qty === 0) return "—";
  return ((run.output_qty / run.input_qty) * 100).toFixed(1) + "%";
}

// ─── Run Type badge ──────────────────────────────────────────────────────────
function RunTypeBadge({ value }: { value: string }) {
  if (value === "MOLDING") {
    return (
      <Badge
        variant="default"
        className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300"
      >
        <FlaskConical className="mr-1 h-3 w-3" />
        Molding
      </Badge>
    );
  }
  if (value === "POLISHING") {
    return (
      <Badge
        variant="secondary"
        className="bg-purple-100 text-purple-700 hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-300"
      >
        <Sparkles className="mr-1 h-3 w-3" />
        Polishing
      </Badge>
    );
  }
  return <Badge variant="outline">{value}</Badge>;
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ value }: { value: string }) {
  if (value === "COMPLETED") {
    return (
      <Badge
        variant="outline"
        className="border-green-500 text-green-700 dark:text-green-400"
      >
        Completed
      </Badge>
    );
  }
  return <Badge variant="destructive">{value}</Badge>;
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: COL_COUNT }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <TableRow>
      <TableCell colSpan={COL_COUNT} className="h-48 text-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <LayoutList className="h-8 w-8 opacity-40" />
          <p className="text-sm font-medium">No production runs yet</p>
          <p className="text-xs">
            Log a molding or polishing run to get started.
          </p>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────
function ErrorState({ message }: { message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={COL_COUNT} className="h-48 text-center">
        <div className="flex flex-col items-center gap-2 text-destructive">
          <AlertCircle className="h-8 w-8 opacity-60" />
          <p className="text-sm font-medium">Failed to load production runs</p>
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Main ledger component ────────────────────────────────────────────────────
export function WIPLedger() {
  const [moldingOpen, setMoldingOpen] = useState(false);
  const [polishingOpen, setPolishingOpen] = useState(false);

  const {
    data: runs = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: wipKeys.runs(),
    queryFn: () => getWIPRuns({ page: 1, page_size: 100 }),
    staleTime: 60_000,
  });

  const errorMessage =
    error instanceof Error ? error.message : "An unexpected error occurred";

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            WIP Production Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track molding and polishing runs across production stages.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            id="log-molding-btn"
            variant="outline"
            size="sm"
            onClick={() => setMoldingOpen(true)}
            className="gap-2"
          >
            <FlaskConical className="h-4 w-4 text-blue-500" />
            Log Molding
          </Button>
          <Button
            id="log-polishing-btn"
            size="sm"
            onClick={() => setPolishingOpen(true)}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Log Polishing
          </Button>
        </div>
      </div>

      {/* ── Production runs table ─────────────────────────────────────────── */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Time</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead>Run Type</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Output Batch</TableHead>
              <TableHead className="text-right">Input (kg)</TableHead>
              <TableHead className="text-right">Output (kg)</TableHead>
              <TableHead className="text-right">Scrap (kg)</TableHead>
              <TableHead className="text-right">Short (kg)</TableHead>
              <TableHead className="text-right">Loss (kg)</TableHead>
              <TableHead className="text-right">Yield</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton />
            ) : isError ? (
              <ErrorState message={errorMessage} />
            ) : runs.length === 0 ? (
              <EmptyState />
            ) : (
              runs.map((run) => (
                <TableRow key={run.run_id} className="group">
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {run.created_at
                      ? format(new Date(run.created_at), "dd MMM, HH:mm")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {run.operator_name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <RunTypeBadge value={run.workstation || run.run_type} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {run.item_sku ? (
                      <span>
                        <span className="font-mono text-xs text-muted-foreground mr-1.5">
                          {run.item_sku}
                        </span>
                        {run.item_name}
                      </span>
                    ) : (
                      (run.item_name ?? run.output_batch_code)
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={outputBatchHref(run)}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {run.output_batch_code}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {run.input_qty.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {run.output_qty.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                    {run.scrap_qty.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                    {run.shortlength_qty.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                    {run.process_loss_qty.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-medium">
                    {yieldPct(run)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={run.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}
      <MoldingDialog open={moldingOpen} onOpenChange={setMoldingOpen} />
      <PolishingDialog open={polishingOpen} onOpenChange={setPolishingOpen} />
    </div>
  );
}
