"use client";

import Link from "next/link";
import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrderAllocations, useOrderDetail } from "@/features/orders/hooks/use-orders";
import { formatCurrency, formatDateTime, formatQuantity } from "@/features/orders/utils/format";
import {
  AllocationStatusBadge,
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/features/orders/utils/status";
import { getOrderErrorMessage } from "@/features/orders/utils/errors";
import { DispatchOrderDialog } from "@/features/orders/components/dispatch-order-dialog";
import { CancelOrderDialog } from "@/features/orders/components/cancel-order-dialog";
import { OrderTimeline } from "@/features/orders/components/order-timeline";
import { InvoiceActions } from "@/features/invoices/components/invoice-actions";

type OrderDetailPageProps = {
  orderId: string;
};

export function OrderDetailPage({ orderId }: OrderDetailPageProps) {
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const orderQuery = useOrderDetail(orderId);
  const allocationsQuery = useOrderAllocations(orderId);

  if (orderQuery.isLoading) {
    return (
      <div className="rounded-xl border bg-background px-4 py-10 text-sm text-muted-foreground">
        Loading order detail...
      </div>
    );
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-10 text-sm text-destructive">
        {getOrderErrorMessage(
          orderQuery.error,
          "Unable to load order detail right now.",
        )}
      </div>
    );
  }

  const order = orderQuery.data;
  const allocations = allocationsQuery.data ?? order.allocations;
  const canDispatch =
    order.status === "RESERVED" || order.status === "PARTIALLY_DISPATCHED";
  const canCancel =
    order.status === "RESERVED" || order.status === "PARTIALLY_DISPATCHED";

  return (
    <div className="space-y-6">
      <header className="rounded-[24px] border bg-background px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold text-foreground">
                {order.order_number}
              </h2>
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.payment_status ?? "UNPAID"} />
            </div>
            <div className="text-sm text-muted-foreground">
              {order.customer.display_name}
              {order.customer.company_name
                ? ` · ${order.customer.company_name}`
                : ""}
            </div>
            <div className="text-sm text-muted-foreground">
              Created {formatDateTime(order.created_at)}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => setDispatchOpen(true)}
              disabled={!canDispatch}
            >
              Dispatch
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelOpen(true)}
              disabled={!canCancel}
            >
              Cancel
            </Button>
            <InvoiceActions orderId={order.id} />
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card className="rounded-[24px]">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Customer Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Customer
                </div>
                <div className="mt-2 font-medium">{order.customer.display_name}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Company
                </div>
                <div className="mt-2 font-medium">
                  {order.customer.company_name || "Direct customer"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Phone
                </div>
                <div className="mt-2 font-medium">
                  {order.customer.phone_number || "Not recorded"}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="overflow-hidden rounded-[24px] border bg-background">
            <div className="border-b px-6 py-4">
              <h3 className="text-base font-semibold text-foreground">
                Order Lines
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Dispatched</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-mono text-xs">
                      {line.item_sku || "-"}
                    </TableCell>
                    <TableCell>{line.item_name}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatQuantity(line.ordered_qty)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatQuantity(line.reserved_qty)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatQuantity(line.dispatched_qty)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(line.unit_price)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(line.line_total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="overflow-hidden rounded-[24px] border bg-background">
            <div className="border-b px-6 py-4">
              <h3 className="text-base font-semibold text-foreground">
                Reservation Allocations
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">Reserved Qty</TableHead>
                  <TableHead className="text-right">Dispatched Qty</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations.map((allocation) => (
                  <TableRow key={allocation.id}>
                    <TableCell>
                      <Link
                        href={`/inventory/finished-goods/batches/${encodeURIComponent(allocation.batch_code)}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {allocation.batch_code}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatQuantity(allocation.reserved_qty)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatQuantity(allocation.dispatched_qty)}
                    </TableCell>
                    <TableCell>
                      <AllocationStatusBadge status={allocation.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <OrderTimeline order={order} />
      </div>

      <DispatchOrderDialog
        open={dispatchOpen}
        onOpenChange={setDispatchOpen}
        order={order}
      />
      <CancelOrderDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        orderId={order.id}
        orderNumber={order.order_number}
      />
    </div>
  );
}
