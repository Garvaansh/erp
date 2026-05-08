"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PurchaseOrder } from "@/features/procurement/types";
import { formatMaterialLabel } from "@/lib/format-spec";

type POTableProps = {
  orders: PurchaseOrder[];
  onRowClick: (order: PurchaseOrder) => void;
};

function statusBadgeVariant(
  status: PurchaseOrder["status"],
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "PENDING":
      return "secondary";
    case "PARTIAL":
      return "default";
    case "COMPLETED":
      return "outline";
    case "CLOSED":
      return "outline";
    default:
      return "outline";
  }
}

function paymentBadgeVariant(
  status: PurchaseOrder["payment_status"],
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PAID":
      return "default";
    case "PARTIAL":
      return "secondary";
    case "UNPAID":
      return "destructive";
    default:
      return "outline";
  }
}

function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return "—";
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatQty(value: number | undefined): string {
  if (value === undefined || value === null) return "—";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(date);
}

export function POTable({ orders, onRowClick }: POTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PO</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Material</TableHead>
            <TableHead>Spec</TableHead>
            <TableHead className="text-right">Ordered</TableHead>
            <TableHead className="text-right">Received</TableHead>
            <TableHead className="text-right">Pending</TableHead>
            <TableHead className="text-right">Unit Price</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const pendingQty =
              order.pending_qty ?? Math.max(0, order.ordered_qty - order.received_qty);

            return (
              <TableRow
                key={order.id}
                className="cursor-pointer"
                onClick={() => onRowClick(order)}
              >
                <TableCell className="font-mono text-xs font-medium">
                  {order.po_number}
                </TableCell>
                <TableCell className="text-sm">
                  <span className="block font-medium">
                    {order.vendor_short_name || order.vendor_name}
                  </span>
                  {order.vendor_code ? (
                    <span className="block text-xs text-muted-foreground">
                      {order.vendor_code}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm">
                  {formatMaterialLabel(order.item_name, order.item_specs)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {order.item_specs || "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatQty(order.ordered_qty)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatQty(order.received_qty)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {pendingQty > 0 ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      {formatQty(pendingQty)}
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      0
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatCurrency(order.unit_price)}
                </TableCell>
                <TableCell>
                  {order.payment_status ? (
                    <Badge variant={paymentBadgeVariant(order.payment_status)}>
                      {order.payment_status}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(order.status)}>
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(order.created_at)}
                </TableCell>
              </TableRow>
            );
          })}

          {orders.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={11}
                className="text-center text-sm text-muted-foreground"
              >
                No purchase orders found.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
