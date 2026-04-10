import Link from "next/link";
import { ApiClientError } from "@/lib/api-client";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getProcurementOrders } from "@/features/procurement/queries";
import { POTable } from "@/features/procurement/components/po-table";
import type { ProcurementOrderListItem } from "@/features/procurement/types";

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
    <div className="space-y-4">
      <Card className="border-slate-200 bg-white">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl text-slate-900">
              Procurement Orders
            </CardTitle>
            <p className="mt-1 text-sm text-slate-600">
              Financial commitments and physical inward receipts.
            </p>
          </div>
          <Link
            href="/procurement/create"
            className={cn(buttonVariants({ variant: "default" }))}
          >
            Create Purchase Order
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {serviceAlert ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {serviceAlert}
            </p>
          ) : null}
          <POTable orders={orders} />
        </CardContent>
      </Card>
    </div>
  );
}
