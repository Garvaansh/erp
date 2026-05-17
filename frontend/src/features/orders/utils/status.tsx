import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  AllocationStatus,
  OrderStatus,
  PaymentStatus,
} from "@/features/orders/types";

function statusClassName(status: OrderStatus) {
  switch (status) {
    case "RESERVED":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "PARTIALLY_DISPATCHED":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "DISPATCHED":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "CANCELLED":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "DRAFT":
      return "border-slate-200 bg-slate-50 text-slate-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-800";
  }
}

function paymentClassName(status: PaymentStatus) {
  switch (status) {
    case "PAID":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "PARTIALLY_PAID":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function allocationClassName(status: AllocationStatus) {
  switch (status) {
    case "RESERVED":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "PARTIALLY_DISPATCHED":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "DISPATCHED":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "border-rose-200 bg-rose-50 text-rose-800";
  }
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant="outline" className={cn("border", statusClassName(status))}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

export function PaymentStatusBadge({
  status = "UNPAID",
}: {
  status?: PaymentStatus;
}) {
  return (
    <Badge variant="outline" className={cn("border", paymentClassName(status))}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

export function AllocationStatusBadge({
  status,
}: {
  status: AllocationStatus;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("border", allocationClassName(status))}
    >
      {status.replaceAll("_", " ")}
    </Badge>
  );
}
