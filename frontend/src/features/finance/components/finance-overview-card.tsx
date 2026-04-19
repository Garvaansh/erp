"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiClientError } from "@/lib/api/api-client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getFinanceOverview } from "@/features/finance/api";
import type { VendorFinanceRow } from "@/features/finance/types";

function formatCurrency(value: number): string {
  return value.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

function statusVariant(status: VendorFinanceRow["payment_status_summary"]) {
  if (status === "PAID") {
    return "default" as const;
  }

  if (status === "PARTIAL") {
    return "secondary" as const;
  }

  return "outline" as const;
}

function getFinanceErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.statusCode === 400) {
      return "Invalid finance request. Please refresh and retry.";
    }

    if (error.statusCode === 409) {
      return "Finance data is currently being updated. Please try again.";
    }

    if (error.statusCode >= 500) {
      return "Server error while loading finance summary. Please try again shortly.";
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Failed to load finance summary.";
}

export function FinanceOverviewCard() {
  const financeQuery = useQuery({
    queryKey: ["finance", "overview"],
    queryFn: getFinanceOverview,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const rows = financeQuery.data?.rows ?? [];
  const totals = financeQuery.data?.totals;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="erp-section-title mb-1">Vendor Payment Visibility</p>
          <h1 className="text-2xl font-bold text-(--erp-text-primary)">
            Finance Overview
          </h1>
        </div>
      </div>

      {totals ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card size="sm" className="erp-card-static bg-card">
            <CardContent className="space-y-1">
              <p className="text-xs text-muted-foreground">Vendors</p>
              <p className="text-lg font-semibold text-foreground">
                {totals.vendors}
              </p>
            </CardContent>
          </Card>
          <Card size="sm" className="erp-card-static bg-card">
            <CardContent className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Value</p>
              <p className="text-lg font-semibold text-foreground">
                {formatCurrency(totals.total_value)}
              </p>
            </CardContent>
          </Card>
          <Card size="sm" className="erp-card-static bg-card">
            <CardContent className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="text-lg font-semibold text-foreground">
                {formatCurrency(totals.total_paid)}
              </p>
            </CardContent>
          </Card>
          <Card size="sm" className="erp-card-static bg-card">
            <CardContent className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Due</p>
              <p className="text-lg font-semibold text-foreground">
                {formatCurrency(totals.total_due)}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card className="erp-card-static bg-card">
        <CardHeader>
          <CardTitle className="text-base">Vendor Payment Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {financeQuery.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading finance summary...
            </div>
          ) : null}

          {financeQuery.isError ? (
            <div className="py-8 text-center text-sm text-destructive">
              {getFinanceErrorMessage(financeQuery.error)}
            </div>
          ) : null}

          {!financeQuery.isLoading &&
          !financeQuery.isError &&
          rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No vendor payment records available.
            </div>
          ) : null}

          {!financeQuery.isLoading &&
          !financeQuery.isError &&
          rows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead className="text-right">Total Paid</TableHead>
                  <TableHead className="text-right">Total Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.vendor_id}>
                    <TableCell>
                      <div className="font-medium">{row.vendor_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.vendor_code || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.order_count}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.total_value)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.total_paid)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.total_due)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusVariant(row.payment_status_summary)}
                      >
                        {row.payment_status_summary}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
