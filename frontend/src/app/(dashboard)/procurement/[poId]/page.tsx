import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiClientError } from "@/lib/api-client";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { POBatchList } from "@/features/procurement/components/po-batch-list";
import { POSummaryCard } from "@/features/procurement/components/po-summary-card";
import { ReceiveStockDialog } from "@/features/procurement/components/receive-stock-dialog";
import { getProcurementOrderDetails } from "@/features/procurement/queries";
import type { ProcurementOrderDetails } from "@/features/procurement/types";

export const dynamic = "force-dynamic";

type ProcurementDetailPageProps = {
  params: Promise<{ poId: string }>;
};

export default async function ProcurementDetailPage({
  params,
}: ProcurementDetailPageProps) {
  const { poId } = await params;

  let details: ProcurementOrderDetails;
  try {
    details = await getProcurementOrderDetails(poId);
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 404) {
      notFound();
    }

    throw error;
  }

  const { order, batches } = details;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/procurement"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Back to Orders
        </Link>
      </div>

      <POSummaryCard order={order} />

      <POBatchList batches={batches} />

      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-base">Attachments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            Challans and invoices will be attached here in the next iteration.
          </p>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-base">Command Area</CardTitle>
        </CardHeader>
        <CardContent>
          {order.remaining_qty > 0 ? (
            <ReceiveStockDialog
              poId={order.id}
              poNumber={order.po_number}
              remainingQty={order.remaining_qty}
            />
          ) : (
            <p className="text-sm text-slate-600">
              Ordered quantity is fully received.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
