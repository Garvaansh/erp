"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useUpdateVendor } from "@/features/vendors/mutations";
import { useVendorProfile } from "@/features/vendors/queries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import { VendorEditDialog } from "@/features/vendors/components/vendor-edit-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type VendorDetailPageProps = {
  params: Promise<{ vendorId: string }>;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export default function VendorDetailPage({ params }: VendorDetailPageProps) {
  const { vendorId } = use(params);
  const { data, isLoading, isError } = useVendorProfile(vendorId);
  const updateVendorMutation = useUpdateVendor();
  const [showEdit, setShowEdit] = useState(false);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading vendor profile...</p>;
  }

  if (isError || !data) {
    return <p className="text-sm text-red-400">Failed to load vendor profile.</p>;
  }

  const { vendor, summary, recent_pos, recent_payments } = data;

  function toggleArchive() {
    updateVendorMutation.mutate({
      id: vendorId,
      payload: { is_active: !vendor.is_active },
    });
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[16px] border border-border bg-card p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-headline tracking-tight">{vendor.name}</h1>
            <Badge variant={vendor.is_active ? "default" : "secondary"}>
              {vendor.is_active ? "Active" : "Archived"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Vendor code: {vendor.code}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-full shadow-sm px-6" onClick={() => setShowEdit(true)}>
            Edit
          </Button>
          <Button type="button" variant="outline" className="rounded-full shadow-sm px-6" onClick={toggleArchive} disabled={updateVendorMutation.isPending}>
            {vendor.is_active ? "Archive" : "Unarchive"}
          </Button>
          <Link href="/procurement/vendors">
            <Button variant="outline" className="rounded-full shadow-sm px-6">Back</Button>
          </Link>
        </div>
      </header>

      <div className="rounded-[16px] border border-[rgba(252,252,252,0.08)] code-well p-6 sm:p-8 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Building2 className="w-48 h-48 text-white" />
        </div>
        <div className="mb-6 relative z-10">
          <h3 className="text-body-lg font-medium text-white">Vendor Snapshot</h3>
        </div>
        <div className="grid gap-8 text-sm sm:grid-cols-2 lg:grid-cols-4 relative z-10">
          <div>
            <p className="text-code-sm text-white/60 uppercase tracking-wider mb-2">Contact Person</p>
            <p className="text-body-lg text-white">{vendor.contact_person || "-"}</p>
          </div>
          <div>
            <p className="text-code-sm text-white/60 uppercase tracking-wider mb-2">Phone</p>
            <p className="text-body-lg text-white">{vendor.phone || "-"}</p>
          </div>
          <div>
            <p className="text-code-sm text-white/60 uppercase tracking-wider mb-2">Email</p>
            <p className="text-body-lg text-white">{vendor.email || "-"}</p>
          </div>
          <div>
            <p className="text-code-sm text-white/60 uppercase tracking-wider mb-2">GSTIN</p>
            <p className="text-body-lg text-white">{vendor.gstin || "-"}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[16px] border border-border bg-card p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col justify-between">
          <h3 className="text-body-lg font-medium text-foreground mb-4">Total Purchased</h3>
          <p className="text-display-sm sm:text-display-md text-foreground tabular-nums leading-none">
            {formatCurrency(summary.total_purchased)}
          </p>
        </div>
        <div className="rounded-[16px] border border-border bg-card p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col justify-between">
          <h3 className="text-body-lg font-medium text-foreground mb-4">Total Paid</h3>
          <p className="text-display-sm sm:text-display-md text-foreground tabular-nums leading-none">
            {formatCurrency(summary.total_paid)}
          </p>
        </div>
        <div className="rounded-[16px] border border-border bg-card p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col justify-between">
          <h3 className="text-body-lg font-medium text-foreground mb-4">Total Due</h3>
          <p className="text-display-sm sm:text-display-md text-destructive tabular-nums leading-none">
            {formatCurrency(summary.total_due)}
          </p>
        </div>
      </div>

      <Tabs defaultValue="pos">
        <TabsList>
          <TabsTrigger value="pos">Recent POs</TabsTrigger>
          <TabsTrigger value="payments">Recent Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="pos" className="rounded-[16px] border border-border bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5">
          {recent_pos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>PO Number</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
              <TableBody>{recent_pos.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">{po.po_number}</TableCell>
                  <TableCell>{new Date(po.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </TabsContent>
        <TabsContent value="payments" className="rounded-[16px] border border-border bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5">
          {recent_payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Transaction</TableHead><TableHead>PO</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>{recent_payments.map((payment) => (
                <TableRow key={payment.transaction_id}>
                  <TableCell className="font-mono">{payment.transaction_id}</TableCell>
                  <TableCell>{payment.po_number}</TableCell>
                  <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      <VendorEditDialog vendor={vendor} open={showEdit} onOpenChange={setShowEdit} />
    </div>
  );
}
