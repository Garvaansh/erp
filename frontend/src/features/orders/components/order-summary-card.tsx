"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PaymentStatusBadge } from "@/features/orders/utils/status";
import { formatCurrency, formatQuantity } from "@/features/orders/utils/format";
import type { OrderSummary } from "@/features/orders/utils/summary";

type OrderSummaryCardProps = {
  summary: OrderSummary;
};

export function OrderSummaryCard({ summary }: OrderSummaryCardProps) {
  return (
    <Card className="rounded-[24px]">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border bg-muted/20 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Subtotal
            </div>
            <div className="mt-2 text-lg font-semibold">
              {formatCurrency(summary.subtotal)}
            </div>
          </div>
          <div className="rounded-2xl border bg-muted/20 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Total Qty
            </div>
            <div className="mt-2 text-lg font-semibold">
              {formatQuantity(summary.totalQty)}
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">GST</span>
            <span className="font-medium">Not captured on this document</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Grand Total</span>
            <span className="font-semibold">{formatCurrency(summary.grandTotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Payment Status</span>
            <PaymentStatusBadge status="UNPAID" />
          </div>
        </div>

        <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          {summary.totalQty > 0
            ? `${formatQuantity(summary.totalQty)} will be reserved from available finished inventory when the order is confirmed.`
            : "Add one or more lines to review the reservation summary."}
        </div>
      </CardContent>
    </Card>
  );
}
