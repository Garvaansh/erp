"use client";

import {
  BatchDetailErrorState,
  BatchDetailLoadingState,
  BatchHeader,
  BatchTypeRedirectState,
  ConsumptionTable,
  LineageTree,
  ProductionRunCard,
  QuantityMetricCard,
  VendorCard,
  summarizeLineageNodes,
  useBatchTypeRedirect,
} from "@/app/(dashboard)/inventory/components/batch-detail-shared";
import { useFinishedBundleDetail } from "@/features/inventory/queries";
import { formatBatchQuantity } from "@/lib/inventory/batch-format";

type FinishedBundleDetailPageProps = {
  batchCode: string;
};

export function FinishedBundleDetailPage({
  batchCode,
}: FinishedBundleDetailPageProps) {
  const detailQuery = useFinishedBundleDetail(batchCode);
  const batch = detailQuery.data?.batch;
  const isWrongType = useBatchTypeRedirect(detailQuery.data, "FINISHED");

  if (detailQuery.isLoading) {
    return <BatchDetailLoadingState />;
  }

  if (detailQuery.isError || !detailQuery.data || !batch) {
    return (
      <BatchDetailErrorState
        backHref="/inventory/finished-goods"
        backLabel="Back to Finished Goods"
        message="Failed to load finished bundle detail."
      />
    );
  }

  if (isWrongType) {
    return <BatchTypeRedirectState />;
  }

  const moldedInputs = summarizeLineageNodes(
    detailQuery.data.lineage.filter((node) => node.batch_type === "MOLDED")
  );
  const rawInputs = summarizeLineageNodes(
    detailQuery.data.lineage.filter((node) => node.batch_type === "RAW")
  );
  const vendorOrigins = Array.from(
    detailQuery.data.vendors.reduce((map, vendor) => {
      const key = `${vendor.raw_batch_code}:${vendor.po_number}:${vendor.vendor_name}`;
      if (!map.has(key)) {
        map.set(key, vendor);
      }
      return map;
    }, new Map<string, (typeof detailQuery.data.vendors)[number]>()).values()
  );

  return (
    <div className="space-y-6">
      <BatchHeader
        batch={batch}
        title="Finished Bundle"
        description="Sellable bundle history with polishing context, material provenance, and procurement source visibility."
        backHref={`/inventory/finished-goods/${batch.item_id}`}
        backLabel="Back to Finished Goods"
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Finished Stock Metrics
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Bundle quantities available for sales, reservation, and compliance review.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <QuantityMetricCard
            label="Bundle Quantity"
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

      <ProductionRunCard
        run={detailQuery.data.production_run}
        title="Polishing Run Summary"
        description="The polishing run that created this finished bundle."
        emptyMessage="No polishing run summary is available for this bundle."
      />

      <LineageTree
        currentBatch={batch}
        title="Production Flow"
        description="Follow this bundle from finished stock back through molded inputs to raw material sources."
        levels={[
          {
            label: "Molded Inputs",
            description: "Direct molded batches consumed during polishing.",
            nodes: moldedInputs,
          },
          {
            label: "Raw Materials Used",
            description: "Procurement batches behind the molded inputs.",
            nodes: rawInputs,
          },
        ]}
        emptyMessage="No manufacturing history was found for this finished bundle."
      />

      <ConsumptionTable
        title="Consumption Audit"
        description="Material consumption records involving this finished bundle."
        rows={detailQuery.data.consumptions}
        emptyMessage="No material consumption records were found for this bundle."
      />

      <section className="rounded-2xl border bg-background">
        <div className="border-b px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            Procurement Sources
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Procurement origins of the raw material batches used in this finished bundle.
          </p>
        </div>

        {vendorOrigins.length === 0 ? (
          <div className="px-6 py-5 text-sm text-muted-foreground">
            No vendor origins were found for this bundle.
          </div>
        ) : (
          <div className="grid gap-3 px-6 py-5 md:grid-cols-2">
            {vendorOrigins.map((vendor) => (
              <VendorCard
                key={`${vendor.raw_batch_code}-${vendor.po_number}`}
                vendor={vendor}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
