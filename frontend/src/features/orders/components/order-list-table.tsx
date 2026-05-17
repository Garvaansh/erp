"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderStatusBadge, PaymentStatusBadge } from "@/features/orders/utils/status";
import { formatDate, formatQuantity } from "@/features/orders/utils/format";
import type { OrderListRow } from "@/features/orders/types";

type OrderListTableProps = {
  rows: OrderListRow[];
};

export function OrderListTable({ rows }: OrderListTableProps) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
        No orders match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Reserved</TableHead>
            <TableHead className="text-right">Dispatched</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer"
              onClick={() => router.push(`/orders/${row.id}`)}
            >
              <TableCell>
                <div className="font-medium text-foreground">{row.order_number}</div>
              </TableCell>
              <TableCell>
                <div className="font-medium">{row.customer_display_name}</div>
                <div className="text-xs text-muted-foreground">
                  {row.customer_company_name || "Direct customer"}
                </div>
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {formatQuantity(row.total_qty)}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {formatQuantity(row.reserved_qty)}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {formatQuantity(row.dispatched_qty)}
              </TableCell>
              <TableCell>
                <PaymentStatusBadge status={row.payment_status ?? "UNPAID"} />
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={row.status} />
              </TableCell>
              <TableCell>{formatDate(row.order_date)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
