"use client";

import { useMemo, useState } from "react";
import { BookOpenTextIcon, LandmarkIcon, ReceiptTextIcon, WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Finance</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Liabilities, payments, and accounting workflows.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void payablesQuery.refetch()}
          loading={payablesQuery.isRefetching}
        >
          Refresh
        </Button>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Vendors</p>
          <p className="text-xl font-semibold text-foreground tabular-nums mt-1">{overview.vendors}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Purchased</p>
          <p className="text-xl font-semibold text-foreground tabular-nums mt-1">
            <MoneyDisplay amount={overview.totalPurchased} />
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Paid</p>
          <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
            <MoneyDisplay amount={overview.totalPaid} />
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Due</p>
          <p className="text-xl font-semibold text-rose-600 dark:text-rose-400 tabular-nums mt-1">
            <MoneyDisplay amount={overview.totalDue} />
          </p>
        </div>
      </div>

      {/* Tabs */}
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

        <TabsContent value="overview" className="pt-4">
          {activeTab === "overview" ? (
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">
                  Highest Outstanding Vendors
                </h3>
              </div>
              <div className="divide-y divide-border">
                {payablesQuery.data.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-muted-foreground text-center">
                    No open vendor balances to summarize yet.
                  </p>
                ) : (
                  payablesQuery.data.slice(0, 5).map((vendor) => (
                    <div
                      key={vendor.vendor_id}
                      className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground">
                          {vendor.vendor_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {vendor.vendor_code || "—"}
                        </p>
                      </div>
                      <MoneyDisplay
                        amount={vendor.total_due}
                        className="text-sm font-semibold text-rose-600 dark:text-rose-400 tabular-nums"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="payables" className="pt-4">
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

        <TabsContent value="receivables" className="pt-4">
          {activeTab === "receivables" ? (
            <PlaceholderTab
              title="Receivables are coming next"
              description="Customer collections and invoice aging will live here once the receivables workflow is ready."
            />
          ) : null}
        </TabsContent>

        <TabsContent value="ledger" className="pt-4">
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
