"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { Truck } from "lucide-react";
import {
  BatchDetailErrorState,
  BatchDetailLoadingState,
  BatchHeader,
  BatchTypeRedirectState,
  ConsumptionTable,
  QuantityMetricCard,
  useBatchTypeRedirect,
} from "@/app/(dashboard)/inventory/components/batch-detail-shared";
import {
  useRawBatchDetail,
  useRawMaterialBatches,
} from "@/features/inventory/queries";
import { formatBatchDate, formatBatchQuantity } from "@/lib/inventory/batch-format";

type RawMaterialBatchDetailPageProps = {
  batchCode: string;
};

export function RawMaterialBatchDetailPage({
  batchCode,
}: RawMaterialBatchDetailPageProps) {
  const detailQuery = useRawBatchDetail(batchCode);
  const batch = detailQuery.data?.batch;

  const procurementQuery = useRawMaterialBatches(batch?.item_id ?? "");
  const procurementBatch = useMemo(() => {
    if (!batch) {
      return null;
    }

    return (procurementQuery.data ?? []).find(
      (row) => row.batch_code === batch.batch_code
    );
  }, [batch, procurementQuery.data]);

  const isWrongType = useBatchTypeRedirect(detailQuery.data, "RAW");

  if (detailQuery.isLoading) {
    return <BatchDetailLoadingState />;
  }

  if (detailQuery.isError || !detailQuery.data || !batch) {
    return (
      <BatchDetailErrorState
        backHref="/inventory/raw-materials"
        backLabel="Back to Raw Materials"
        message="Failed to load raw material batch detail."
      />
    );
  }

  if (isWrongType) {
    return <BatchTypeRedirectState />;
  }

  const downstreamRows = detailQuery.data.consumptions.filter(
    (row) => row.source_batch_code === batch.batch_code
  );
  const moldedTargets = Array.from(
    downstreamRows
      .filter(
        (row) => row.target_batch_code && row.target_batch_type === "MOLDED"
      )
      .reduce((map, row) => {
        const key = row.target_batch_code;
        const existing = map.get(key);

        if (existing) {
          existing.qty += row.quantity_consumed;
          existing.lastUsedAt = row.created_at;
        } else {
          map.set(key, {
            batchCode: row.target_batch_code,
            qty: row.quantity_consumed,
            lastUsedAt: row.created_at,
          });
        }

        return map;
      }, new Map<string, { batchCode: string; qty: number; lastUsedAt: string }>())
      .values()
  );

  return (
    <div className="space-y-6">
      <BatchHeader
        batch={batch}
        title="Raw Material Batch"
        description="Procurement-origin stock with receiving context and downstream usage."
        backHref={`/inventory/raw-materials/${batch.item_id}`}
        backLabel="Back to Raw Material Ledger"
      />

      <section className="rounded-2xl border bg-background">
        <div className="border-b px-6 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Truck className="h-4 w-4" />
            Vendor and PO Details
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Purchase source for this received raw material batch.
          </p>
        </div>

        <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
          <InfoBlock
            label="Vendor"
            value={procurementBatch?.vendor_name || "Unknown vendor"}
          />
          <InfoBlock
            label="PO Reference"
            value={
              procurementBatch?.parent_po_id && procurementBatch.po_number ? (
                <Link
                  href={`/procurement/${procurementBatch.parent_po_id}`}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {procurementBatch.po_number}
                </Link>
              ) : (
                procurementBatch?.po_number || "-"
              )
            }
          />
          <InfoBlock
            label="Received Date"
            value={formatBatchDate(procurementBatch?.received_at || "")}
          />
          <InfoBlock
            label="Batch Status"
            value={batch.status}
          />
        </div>
      </section>

      <section className="rounded-2xl border bg-background">
        <div className="border-b px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            Procurement Metadata
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Receiving and material context for procurement audit and stock review.
          </p>
        </div>

        <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
          <InfoBlock
            label="Material"
            value={`${batch.item_sku ? `${batch.item_sku} | ` : ""}${batch.item_name}`}
          />
          <InfoBlock label="Batch Code" value={batch.batch_code} />
          <InfoBlock
            label="Batch Created"
            value={formatBatchDate(batch.created_at)}
          />
          <InfoBlock label="Batch Type" value="Raw Material" />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Stock Metrics</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Quantity received, reserved, and still available for production.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <QuantityMetricCard
            label="Initial Quantity"
            value={formatBatchQuantity(batch.initial_qty)}
          />
          <QuantityMetricCard
            label="Remaining Stock"
            value={formatBatchQuantity(batch.remaining_qty)}
          />
          <QuantityMetricCard
            label="Reserved Stock"
            value={formatBatchQuantity(batch.reserved_qty)}
          />
          <QuantityMetricCard
            label="Available Stock"
            value={formatBatchQuantity(
              Math.max(batch.remaining_qty - batch.reserved_qty, 0)
            )}
          />
        </div>
      </section>

      <ConsumptionTable
        title="Consumption History"
        description="Downstream manufacturing runs that have consumed this raw material batch."
        rows={downstreamRows}
        emptyMessage="This raw material batch has not been consumed yet."
      />

      <section className="rounded-2xl border bg-background">
        <div className="border-b px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            Downstream Molded Batches
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Molded WIP batches created using this procurement batch.
          </p>
        </div>

        {moldedTargets.length === 0 ? (
          <div className="px-6 py-5 text-sm text-muted-foreground">
            No molded WIP batches have consumed this raw material batch yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Molded Batch</th>
                  <th className="px-6 py-3 font-medium text-right">
                    Qty Consumed
                  </th>
                  <th className="px-6 py-3 font-medium">Last Used</th>
                </tr>
              </thead>
              <tbody>
                {moldedTargets.map((target) => (
                  <tr key={target.batchCode} className="border-b last:border-0">
                    <td className="px-6 py-4 font-mono text-xs">
                      <Link
                        href={`/production/wip/batches/${encodeURIComponent(
                          target.batchCode
                        )}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {target.batchCode}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums">
                      {formatBatchQuantity(target.qty)}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {formatBatchDate(target.lastUsedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function InfoBlock({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
