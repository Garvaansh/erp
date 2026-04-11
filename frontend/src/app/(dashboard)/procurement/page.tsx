import Link from "next/link";
import { ApiClientError } from "@/lib/api-client";
import { getProcurementOrders } from "@/features/procurement/queries";
import { POTable } from "@/features/procurement/components/po-table";
import type { ProcurementOrderListItem } from "@/features/procurement/types";
import { Plus, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProcurementPage() {
  let serviceAlert: string | undefined;
  let orders: ProcurementOrderListItem[] = [];

  try {
    orders = await getProcurementOrders();
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode >= 500) {
      serviceAlert =
        "Procurement services are temporarily unavailable. Please retry shortly.";
    } else {
      throw error;
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="erp-section-title mb-1">Supply Chain</p>
          <h1 className="text-2xl font-bold text-[var(--erp-text-primary)]">
            Procurement Orders
          </h1>
          <p className="text-sm text-[var(--erp-text-muted)] mt-1">
            Financial commitments and physical inward receipts.
          </p>
        </div>
        <Link
          href="/procurement/create"
          className="flex items-center gap-2 rounded-lg bg-[var(--erp-accent)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] hover:bg-[var(--erp-accent-bright)] transition-colors shadow-lg shadow-cyan-500/15"
        >
          <Plus className="size-4" />
          Create Purchase Order
        </Link>
      </div>

      {serviceAlert && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
          <AlertTriangle className="size-4 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">{serviceAlert}</p>
        </div>
      )}

      <div className="erp-card-static overflow-hidden">
        <POTable orders={orders} />
      </div>
    </div>
  );
}
