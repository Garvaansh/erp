"use client";

import { useMemo } from "react";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExpandableRow } from "@/components/common/expandable-row";
import { MoneyDisplay } from "@/components/common/money-display";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import type { PayablePO, PayablesResponse } from "@/types/finance";

type PayablesTabProps = {
  vendors: PayablesResponse;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  onLogPayment: (po: PayablePO, vendorName: string) => void;
};

function formatPaymentDate(value: string | null): string {
  if (!value) {
    return "No payments yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "No payments yet";
  }

  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function PayablesTab({
  vendors,
  isLoading,
  error,
  onRetry,
  onLogPayment,
}: PayablesTabProps) {
  const totalUnpaidPOs = useMemo(
    () =>
      vendors.reduce((count, vendor) => count + vendor.unpaid_pos.length, 0),
    [vendors],
  );

  if (isLoading) {
    return (
      <LoadingState
        title="Loading payables"
        description="Checking outstanding vendor balances and unpaid purchase orders."
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Unable to load payables"
        description={error.message || "Please try again."}
        onRetry={onRetry}
      />
    );
  }

  if (vendors.length === 0) {
    return (
      <EmptyState
        title="No outstanding payables"
        description="All vendor balances are settled, so there is nothing to action here."
      />
    );
  }

  return (
    <div className="space-y-4" data-testid="payables-tab-panel">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Outstanding Payables</CardTitle>
            <CardDescription>
              Review vendors with open balances and log payments against unpaid purchase orders.
            </CardDescription>
          </div>
          <div className="text-sm text-muted-foreground">
            {vendors.length} vendors • {totalUnpaidPOs} unpaid POs
          </div>
        </CardHeader>
      </Card>

      <Accordion type="multiple" className="space-y-3">
        {vendors.map((vendor) => (
          <ExpandableRow
            key={vendor.vendor_id}
            value={vendor.vendor_id}
            title={vendor.vendor_name}
            subtitle={vendor.vendor_code || "Vendor code unavailable"}
            triggerLabel={`Toggle ${vendor.vendor_name}`}
            summary={
              <div className="grid min-w-[240px] grid-cols-3 gap-4 text-right text-xs sm:text-sm">
                <div className="space-y-1">
                  <div className="text-muted-foreground">Purchased</div>
                  <MoneyDisplay amount={vendor.total_purchased} className="font-medium text-foreground" />
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Paid</div>
                  <MoneyDisplay amount={vendor.total_paid} className="font-medium text-foreground" />
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Due</div>
                  <MoneyDisplay amount={vendor.total_due} className="font-semibold text-destructive" />
                </div>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO</TableHead>
                    <TableHead>Total Value</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Last Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendor.unpaid_pos.map((po) => (
                    <TableRow key={po.po_id}>
                      <TableCell>
                        <div className="font-medium">{po.po_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {po.status}
                        </div>
                      </TableCell>
                      <TableCell>
                        <MoneyDisplay amount={po.total_value} />
                      </TableCell>
                      <TableCell>
                        <MoneyDisplay amount={po.paid} />
                      </TableCell>
                      <TableCell>
                        <MoneyDisplay amount={po.due} className="font-medium text-destructive" />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatPaymentDate(po.last_payment_date)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={po.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onLogPayment(po, vendor.vendor_name)}
                        >
                          Log Payment
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ExpandableRow>
        ))}
      </Accordion>
    </div>
  );
}
