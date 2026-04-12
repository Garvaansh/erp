"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { POCreateForm } from "@/features/procurement/components/po-create-form";
import { getProcurementMaterialOptions } from "@/lib/api/procurement";
import { ApiClientError } from "@/lib/api/api-client";
import { procurementKeys } from "@/lib/react-query/keys";

export default function ProcurementCreatePage() {
  const materialsQuery = useQuery({
    queryKey: procurementKeys.materialOptions(),
    queryFn: getProcurementMaterialOptions,
  });

  const serviceAlert = useMemo(() => {
    if (
      materialsQuery.error instanceof ApiClientError &&
      materialsQuery.error.statusCode >= 500
    ) {
      return "Material lookup is unavailable. Verify backend connectivity and retry.";
    }

    return undefined;
  }, [materialsQuery.error]);

  if (materialsQuery.error && !serviceAlert) {
    throw materialsQuery.error;
  }

  const materials = materialsQuery.data ?? [];

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
