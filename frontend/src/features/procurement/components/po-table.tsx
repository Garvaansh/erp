import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ProcurementOrderListItem } from "@/features/procurement/types";

type POTableProps = {
  orders: ProcurementOrderListItem[];
};

const quantityFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function statusVariant(status: ProcurementOrderListItem["status"]) {
  if (status === "DELIVERED") {
    return "default" as const;
  }

  if (status === "CANCELLED") {
    return "destructive" as const;
  }

  return "secondary" as const;
}

export function POTable({ orders }: POTableProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        No purchase orders yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PO Number</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Material</TableHead>
            <TableHead className="text-right">Qty (kg)</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium text-slate-900">
                <Link
                  href={`/procurement/${order.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {order.po_number}
                </Link>
              </TableCell>
              <TableCell className="text-slate-600">
                {order.created_at
                  ? new Date(order.created_at).toLocaleDateString("en-IN")
                  : "-"}
              </TableCell>
              <TableCell>{order.supplier_name || "-"}</TableCell>
              <TableCell>
                <span className="text-slate-900">
                  {order.item_name || "Material"}
                </span>
                {order.item_sku ? (
                  <span className="ml-2 text-xs text-slate-500">
                    {order.item_sku}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="text-right font-mono text-slate-700">
                {quantityFormatter.format(order.ordered_qty)}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(order.status)}>
                  {order.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
