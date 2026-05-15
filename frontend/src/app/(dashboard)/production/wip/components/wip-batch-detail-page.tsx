"use client";

import {
  BatchReferenceSection,
  BatchDetailErrorState,
  BatchDetailLoadingState,
  BatchHeader,
  BatchTypeRedirectState,
  ConsumptionTable,
  ProductionRunCard,
  QuantityMetricCard,
  summarizeLineageNodes,
  useBatchTypeRedirect,
} from "@/app/(dashboard)/inventory/components/batch-detail-shared";
import { useWipBatchDetail } from "@/features/inventory/queries";
import { formatBatchQuantity } from "@/lib/inventory/batch-format";

type WipBatchDetailPageProps = {
  batchCode: string;
};

export function WipBatchDetailPage({ batchCode }: WipBatchDetailPageProps) {
  const detailQuery = useWipBatchDetail(batchCode);
  const batch = detailQuery.data?.batch;
  const isWrongType = useBatchTypeRedirect(detailQuery.data, "MOLDED");

  if (detailQuery.isLoading) {
    return <BatchDetailLoadingState />;
  }

  if (detailQuery.isError || !detailQuery.data || !batch) {
    return (
      <BatchDetailErrorState
        backHref="/production/wip"
        backLabel="Back to Production"
        message="Failed to load WIP batch detail."
      />
    );
  }

  if (isWrongType) {
    return <BatchTypeRedirectState />;
  }

  const downstreamRows = detailQuery.data.consumptions.filter(
    (row) => row.source_batch_code === batch.batch_code
  );
  const rawInputs = summarizeLineageNodes(
    detailQuery.data.lineage.filter((node) => node.batch_type === "RAW")
  );

  return (
    <div className="space-y-6">
      <BatchHeader
        batch={batch}
        title="Molded WIP Batch"
        description="Manufacturing work-in-progress with molding performance and downstream polishing usage."
        backHref="/production/wip"
        backLabel="Back to Production"
      />

      <ProductionRunCard
        run={detailQuery.data.production_run}
        title="Manufacturing Run Summary"
        description="The molding run that produced this WIP batch."
        emptyMessage="No molding run summary is available for this batch."
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Process Metrics</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Current WIP balance available after reservations and downstream production usage.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <QuantityMetricCard
            label="Produced Quantity"
            value={formatBatchQuantity(batch.initial_qty)}
          />
          <QuantityMetricCard
            label="Remaining WIP"
            value={formatBatchQuantity(batch.remaining_qty)}
          />
          <QuantityMetricCard
            label="Reserved WIP"
            value={formatBatchQuantity(batch.reserved_qty)}
          />
          <QuantityMetricCard
            label="Available for Polishing"
            value={formatBatchQuantity(
              Math.max(batch.remaining_qty - batch.reserved_qty, 0)
            )}
          />
        </div>
      </section>

      <ConsumptionTable
        title="Downstream Polishing Usage"
        description="Finished bundles produced using this molded WIP batch."
        rows={downstreamRows.filter((row) => row.target_batch_type === "FINISHED")}
        emptyMessage="This molded WIP batch has not been used in polishing yet."
      />

      <BatchReferenceSection
        title="Raw Materials Used"
        description="Procurement batches consumed during molding for this WIP output."
        nodes={rawInputs}
        emptyMessage="No upstream raw material references were found."
      />

      <ConsumptionTable
        title="Consumption Audit"
        description="All material consumption records involving this molded WIP batch."
        rows={detailQuery.data.consumptions}
        emptyMessage="No material consumption records were found for this molded batch."
      />
    </div>
  );
}
