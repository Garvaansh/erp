"use client";

import { useMemo, useState } from "react";
import { BookOpenTextIcon, LandmarkIcon, ReceiptTextIcon, WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaymentModal } from "@/components/common/payment-modal";
import { MoneyDisplay } from "@/components/common/money-display";
import { EmptyState } from "@/components/common/states";
import { useLogPayment } from "@/hooks/useLogPayment";
import { usePayables } from "@/hooks/usePayables";
import type { LogPaymentPayload, PayablePO } from "@/types/finance";
import { LedgerTab } from "./ledger-tab";
import { PayablesTab } from "./payables-tab";

function PlaceholderTab({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return <EmptyState title={title} description={description} />;
}

export function FinancePageClient() {
  const payablesQuery = usePayables();
  const logPaymentMutation = useLogPayment();
  const [activeTab, setActiveTab] = useState("payables");
  const [selectedPO, setSelectedPO] = useState<PayablePO | null>(null);
  const [selectedVendorName, setSelectedVendorName] = useState("");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const overview = useMemo(() => {
    return payablesQuery.data.reduce(
      (totals, vendor) => {
        totals.vendors += 1;
        totals.totalPurchased += vendor.total_purchased;
        totals.totalPaid += vendor.total_paid;
        totals.totalDue += vendor.total_due;
        return totals;
      },
      {
        vendors: 0,
        totalPurchased: 0,
        totalPaid: 0,
        totalDue: 0,
      },
    );
  }, [payablesQuery.data]);

  function handleLogPaymentClick(po: PayablePO, vendorName: string) {
    setSelectedPO(po);
    setSelectedVendorName(vendorName);
    setPaymentModalOpen(true);
  }

  async function handlePaymentSubmit(payload: LogPaymentPayload) {
    await logPaymentMutation.mutateAsync(payload);
    toast.success("Payment logged successfully.");
    setPaymentModalOpen(false);
    setSelectedPO(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="erp-section-title mb-1">Finance Workspace</p>
          <h1 className="text-2xl font-bold text-(--erp-text-primary)">
            Finance
          </h1>
          <p className="text-sm text-muted-foreground">
            Track liabilities, payment activity, and upcoming accounting workflows from one place.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void payablesQuery.refetch()}
          loading={payablesQuery.isRefetching}
        >
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="overview">
            <LandmarkIcon />
            Overview
          </TabsTrigger>
          <TabsTrigger value="payables">
            <WalletIcon />
            Payables
          </TabsTrigger>
          <TabsTrigger value="receivables">
            <ReceiptTextIcon />
            Receivables
          </TabsTrigger>
          <TabsTrigger value="ledger">
            <BookOpenTextIcon />
            Ledger
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-2">
          {activeTab === "overview" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">
                      Vendors With Due
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    {overview.vendors}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">
                      Total Purchased
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    <MoneyDisplay amount={overview.totalPurchased} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">
                      Total Paid
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    <MoneyDisplay amount={overview.totalPaid} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">
                      Total Due
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold text-destructive">
                    <MoneyDisplay amount={overview.totalDue} />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Highest Outstanding Vendors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {payablesQuery.data.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No open vendor balances to summarize yet.
                    </p>
                  ) : (
                    payablesQuery.data.slice(0, 5).map((vendor) => (
                      <div
                        key={vendor.vendor_id}
                        className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-foreground">
                            {vendor.vendor_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {vendor.vendor_code || "Vendor code unavailable"}
                          </div>
                        </div>
                        <MoneyDisplay
                          amount={vendor.total_due}
                          className="font-semibold text-destructive"
                        />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="payables" className="pt-2">
          {activeTab === "payables" ? (
            <PayablesTab
              vendors={payablesQuery.data}
              isLoading={payablesQuery.isLoading}
              error={payablesQuery.error}
              onRetry={() => void payablesQuery.refetch()}
              onLogPayment={handleLogPaymentClick}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="receivables" className="pt-2">
          {activeTab === "receivables" ? (
            <PlaceholderTab
              title="Receivables are coming next"
              description="Customer collections and invoice aging will live here once the receivables workflow is ready."
            />
          ) : null}
        </TabsContent>

        <TabsContent value="ledger" className="pt-2">
          {activeTab === "ledger" ? <LedgerTab /> : null}
        </TabsContent>
      </Tabs>

      <PaymentModal
        open={paymentModalOpen}
        po={selectedPO}
        vendorName={selectedVendorName}
        onOpenChange={(open) => {
          setPaymentModalOpen(open);
          if (!open) {
            setSelectedPO(null);
          }
        }}
        onSubmit={handlePaymentSubmit}
        isSubmitting={logPaymentMutation.isPending}
      />
    </div>
  );
}
