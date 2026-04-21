import { Badge } from "@/components/ui/badge";
import type { PayablePOStatus } from "@/types/finance";

type StatusBadgeProps = {
  status: PayablePOStatus;
};

function statusVariant(status: PayablePOStatus) {
  if (status === "PAID") {
    return "outline" as const;
  }

  if (status === "PARTIAL") {
    return "secondary" as const;
  }

  return "destructive" as const;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <Badge variant={statusVariant(status)}>{status}</Badge>;
}
