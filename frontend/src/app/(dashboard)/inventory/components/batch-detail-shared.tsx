"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  Factory,
  FlaskConical,
  Package,
  Sparkles,
} from "lucide-react";
import {
  BatchConsumption,
  BatchDetailBatch,
  BatchLineageNode,
  BatchProductionRun,
  BatchTraceabilityData,
  BatchVendorOrigin,
  InventoryBatchType,
} from "@/lib/api/batch-traceability";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  batchStatusVariant,
  batchTypeLabel,
  formatBatchDate,
  formatBatchDateShort,
  formatBatchQuantity,
} from "@/lib/inventory/batch-format";
import {
  getBatchDetailHref,
  getBatchDetailHrefForBatch,
} from "@/lib/inventory/batch-routing";

type BatchHeaderProps = {
  batch: BatchDetailBatch;
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
};

type QuantityMetricCardProps = {
  label: string;
  value: string;
  tone?: "default" | "muted";
};

type ProductionRunCardProps = {
  run: BatchProductionRun | null;
  title: string;
  description: string;
  emptyMessage: string;
};

type ConsumptionTableProps = {
  title: string;
  description: string;
  rows: BatchConsumption[];
  emptyMessage: string;
};

type VendorCardProps = {
  vendor: BatchVendorOrigin;
};

type LineageTreeLevel = {
  label: string;
  description: string;
  nodes: BatchLineageNode[];
};

type LineageTreeProps = {
  currentBatch: BatchDetailBatch;
  title: string;
  description: string;
  levels: LineageTreeLevel[];
  emptyMessage: string;
};

type BatchReferenceSectionProps = {
  title: string;
  description: string;
  nodes: BatchLineageNode[];
  emptyMessage: string;
};

export function useBatchTypeRedirect(
  data: BatchTraceabilityData | undefined,
  expectedType: InventoryBatchType
) {
  const router = useRouter();
  const isWrongType = Boolean(data && data.batch.batch_type !== expectedType);

  useEffect(() => {
    if (!data || data.batch.batch_type === expectedType) {
      return;
    }

    router.replace(getBatchDetailHrefForBatch(data.batch));
  }, [data, expectedType, router]);

  return isWrongType;
}

export function BatchDetailLoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export function BatchDetailErrorState({
  message,
  backHref,
  backLabel,
}: {
  message: string;
  backHref: string;
  backLabel: string;
}) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" onClick={() => router.push(backHref)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {backLabel}
      </Button>
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        {message}
      </div>
    </div>
  );
}

export function BatchTypeRedirectState() {
  return (
    <div className="rounded-xl border bg-background px-4 py-6 text-sm text-muted-foreground">
      Redirecting to the correct batch view...
    </div>
  );
}

export function BatchHeader({
  batch,
  title,
  description,
  backHref,
  backLabel,
}: BatchHeaderProps) {
  const router = useRouter();

  return (
    <section className="space-y-4">
      <Button variant="outline" size="sm" onClick={() => router.push(backHref)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {backLabel}
      </Button>

      <div className="rounded-2xl border bg-background px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-muted p-2 text-muted-foreground">
                {batchTypeIcon(batch.batch_type)}
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {title}
                </p>
                <h1 className="font-mono text-2xl font-semibold tracking-tight">
                  {batch.batch_code}
                </h1>
              </div>
              <Badge variant={batchStatusVariant(batch.status)}>
                {batch.status}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-foreground">
                {batch.item_sku ? `${batch.item_sku} | ` : ""}
                {batch.item_name}
              </p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            <p>{batchTypeLabel(batch.batch_type)}</p>
            <p>Created {formatBatchDate(batch.created_at)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function QuantityMetricCard({
  label,
  value,
  tone = "default",
}: QuantityMetricCardProps) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        tone === "muted" ? "bg-muted/30" : "bg-background"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function ProductionRunCard({
  run,
  title,
  description,
  emptyMessage,
}: ProductionRunCardProps) {
  return (
    <section className="rounded-2xl border bg-background">
      <div className="border-b px-6 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Factory className="h-4 w-4" />
          {title}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>

      {!run ? (
        <div className="px-6 py-5 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid gap-3 px-6 py-5 md:grid-cols-3 xl:grid-cols-6">
          <QuantityMetricCard
            label="Input"
            value={formatBatchQuantity(run.input_qty)}
            tone="muted"
          />
          <QuantityMetricCard
            label="Output"
            value={formatBatchQuantity(run.output_qty)}
            tone="muted"
          />
          <QuantityMetricCard
            label="Scrap"
            value={formatBatchQuantity(run.scrap_qty)}
            tone="muted"
          />
          <QuantityMetricCard
            label="Shortlength"
            value={formatBatchQuantity(run.shortlength_qty)}
            tone="muted"
          />
          <QuantityMetricCard
            label="Process Yield"
            value={`${run.yield_pct.toFixed(1)}%`}
            tone="muted"
          />
          <div className="rounded-xl border bg-muted/30 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Run Context
            </p>
            <div className="mt-1 space-y-1 text-sm">
              <p>{run.production_stage}</p>
              <p className="text-muted-foreground">
                Operator: {run.operator_name || "-"}
              </p>
              <p className="text-muted-foreground">
                Logged {formatBatchDate(run.created_at)}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function ConsumptionTable({
  title,
  description,
  rows,
  emptyMessage,
}: ConsumptionTableProps) {
  return (
    <section className="rounded-2xl border bg-background">
      <div className="border-b px-6 py-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-5 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source Batch</TableHead>
                <TableHead>Target Batch</TableHead>
                <TableHead className="text-right">Qty Consumed</TableHead>
                <TableHead className="text-right">Before</TableHead>
                <TableHead className="text-right">After</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">
                    <BatchRouteLink
                      batchCode={row.source_batch_code}
                      batchType={row.source_batch_type}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.target_batch_code ? (
                      <BatchRouteLink
                        batchCode={row.target_batch_code}
                        batchType={row.target_batch_type}
                      />
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatBatchQuantity(row.quantity_consumed)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {formatBatchQuantity(row.batch_remaining_before)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {formatBatchQuantity(row.batch_remaining_after)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatBatchDate(row.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

export function VendorCard({ vendor }: VendorCardProps) {
  return (
    <div className="rounded-xl border bg-background px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {vendor.vendor_name || "Unknown vendor"}
        </p>
        <span className="font-mono text-xs text-muted-foreground">
          {vendor.raw_batch_code}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>PO: {vendor.po_number || "-"}</span>
        <span>Received: {formatBatchDateShort(vendor.procurement_date)}</span>
      </div>
    </div>
  );
}

export function LineageTree({
  currentBatch,
  title,
  description,
  levels,
  emptyMessage,
}: LineageTreeProps) {
  const visibleLevels = levels.filter((level) => level.nodes.length > 0);

  return (
    <section className="rounded-2xl border bg-background">
      <div className="border-b px-6 py-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>

      {visibleLevels.length === 0 ? (
        <div className="px-6 py-5 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-4 px-6 py-5">
          <LineageNodeCard node={currentBatch} highlight />

          {visibleLevels.map((level) => (
            <div key={level.label} className="space-y-3">
              <div className="flex items-center gap-3 pl-4 text-muted-foreground">
                <ArrowDown className="h-4 w-4" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                    {level.label}
                  </p>
                  <p className="text-xs">{level.description}</p>
                </div>
              </div>
              <div className="space-y-3 pl-10">
                {level.nodes.map((node) => (
                  <LineageNodeCard key={`${level.label}-${node.batch_id}`} node={node} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function BatchReferenceSection({
  title,
  description,
  nodes,
  emptyMessage,
}: BatchReferenceSectionProps) {
  return (
    <section className="rounded-2xl border bg-background">
      <div className="border-b px-6 py-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>

      {nodes.length === 0 ? (
        <div className="px-6 py-5 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid gap-3 px-6 py-5 md:grid-cols-2">
          {nodes.map((node) => (
            <LineageNodeCard key={node.batch_id} node={node} />
          ))}
        </div>
      )}
    </section>
  );
}

export function summarizeLineageNodes(nodes: BatchLineageNode[]) {
  const map = new Map<string, BatchLineageNode>();

  for (const node of nodes) {
    const existing = map.get(node.batch_id);
    if (!existing) {
      map.set(node.batch_id, { ...node });
      continue;
    }

    existing.quantity_consumed += node.quantity_consumed;
  }

  return Array.from(map.values()).sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );
}

function BatchRouteLink({
  batchCode,
  batchType,
}: {
  batchCode: string;
  batchType: string;
}) {
  const href =
    batchType === "RAW" || batchType === "MOLDED" || batchType === "FINISHED"
      ? getBatchDetailHref(batchType, batchCode)
      : null;

  if (!href) {
    return (
      <span>
        {batchCode}{" "}
        <span className="text-muted-foreground">({batchType || "UNKNOWN"})</span>
      </span>
    );
  }

  return (
    <Link href={href} className="text-primary underline-offset-2 hover:underline">
      {batchCode}{" "}
      <span className="text-muted-foreground">({batchType})</span>
    </Link>
  );
}

function LineageNodeCard({
  node,
  highlight = false,
}: {
  node: Pick<
    BatchLineageNode,
    | "batch_code"
    | "batch_type"
    | "status"
    | "item_sku"
    | "item_name"
    | "created_at"
    | "remaining_qty"
  > & {
    quantity_consumed?: number;
  };
  highlight?: boolean;
}) {
  const href = getBatchDetailHref(node.batch_type, node.batch_code);
  const body = (
    <div
      className={`rounded-xl border px-4 py-3 ${
        highlight ? "border-primary/40 bg-primary/5" : "bg-muted/20"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-background p-1.5 text-muted-foreground">
            {batchTypeIcon(node.batch_type)}
          </span>
          <div>
            <p className="font-mono text-sm font-medium">{node.batch_code}</p>
            <p className="text-xs text-muted-foreground">
              {node.item_sku ? `${node.item_sku} | ` : ""}
              {node.item_name}
            </p>
          </div>
        </div>
        <Badge variant={batchStatusVariant(node.status)}>{node.status}</Badge>
      </div>

      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>{batchTypeLabel(node.batch_type)}</span>
        <span>Created {formatBatchDateShort(node.created_at)}</span>
        <span>Remaining {formatBatchQuantity(node.remaining_qty)}</span>
        {(node.quantity_consumed ?? 0) > 0 ? (
          <span>
            Consumed {formatBatchQuantity(node.quantity_consumed ?? 0)}
          </span>
        ) : null}
      </div>
    </div>
  );

  if (highlight) {
    return body;
  }

  return <Link href={href}>{body}</Link>;
}

function batchTypeIcon(type: InventoryBatchType): ReactNode {
  switch (type) {
    case "RAW":
      return <Package className="h-4 w-4" />;
    case "MOLDED":
      return <FlaskConical className="h-4 w-4" />;
    case "FINISHED":
      return <Sparkles className="h-4 w-4" />;
  }
}
