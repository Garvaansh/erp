import Link from "next/link";
import { ApiClientError } from "@/lib/api-client";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { POCreateForm } from "@/features/procurement/components/po-create-form";
import { getProcurementMaterialOptions } from "@/features/procurement/queries";
import type { ProcurementMaterialOption } from "@/features/procurement/types";

export const dynamic = "force-dynamic";

export default async function ProcurementCreatePage() {
  let serviceAlert: string | undefined;
  let materials: ProcurementMaterialOption[] = [];

  try {
    materials = await getProcurementMaterialOptions();
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode >= 500) {
      serviceAlert =
        "Material lookup is unavailable. Verify backend connectivity and retry.";
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
              Create Purchase Order
            </CardTitle>
            <p className="mt-1 text-sm text-slate-600">
              Lock supplier, quantity, and rate before goods inward.
            </p>
          </div>
          <Link
            href="/procurement"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Back to Orders
          </Link>
        </CardHeader>
        <CardContent>
          {serviceAlert ? (
            <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {serviceAlert}
            </p>
          ) : null}
          <POCreateForm materials={materials} />
        </CardContent>
      </Card>
    </div>
  );
}
