import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ProcurementOrderListItem } from "@/features/procurement/types";

const numberFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type POSummaryCardProps = {
  order: ProcurementOrderListItem;
};

function statusVariant(status: ProcurementOrderListItem["status"]) {
  if (status === "DELIVERED") return "default" as const;
  if (status === "CANCELLED") return "destructive" as const;
  return "secondary" as const;
}

export function POSummaryCard({ order }: POSummaryCardProps) {
  const progressValue =
    order.ordered_qty > 0
      ? Math.min((order.received_qty / order.ordered_qty) * 100, 100)
      : 0;

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg text-slate-900">
            {order.po_number}
          </CardTitle>
          <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
        </div>
        <p className="text-sm text-slate-600">
          Supplier:{" "}
          <span className="font-medium text-slate-900">
            {order.supplier_name || "-"}
          </span>
        </p>
        <p className="text-sm text-slate-600">
          Material:{" "}
          <span className="font-medium text-slate-900">
            {order.item_name || "Material"}
          </span>
          {order.item_sku ? (
            <span className="ml-2 text-xs text-slate-500">
              {order.item_sku}
            </span>
          ) : null}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-slate-300 bg-slate-100 text-slate-700"
          >
            <Lock className="size-3" />
            INR {currencyFormatter.format(order.unit_price)} / kg
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <span>
              Ordered:{" "}
              <span className="font-medium text-slate-900">
                {numberFormatter.format(order.ordered_qty)} kg
              </span>
            </span>
            <span>
              Received:{" "}
              <span className="font-medium text-slate-900">
                {numberFormatter.format(order.received_qty)} kg
              </span>
            </span>
          </div>
          <Progress value={progressValue} />
        </div>
      </CardContent>
    </Card>
  );
}
