"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useUpdateVendor } from "@/features/vendors/mutations";
import { useVendorProfile } from "@/features/vendors/queries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{vendor.name}</h1>
          <p className="text-sm text-muted-foreground">Vendor code: {vendor.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={vendor.is_active ? "default" : "secondary"}>
            {vendor.is_active ? "Active" : "Archived"}
          </Badge>
          <Button type="button" variant="outline" onClick={() => setShowEdit(true)}>
            Edit
          </Button>
          <Button type="button" variant="outline" onClick={toggleArchive} disabled={updateVendorMutation.isPending}>
            {vendor.is_active ? "Archive" : "Unarchive"}
          </Button>
          <Link href="/procurement/vendors">
            <Button variant="outline">Back</Button>
          </Link>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Vendor Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Contact Person</p>
            <p className="font-medium">{vendor.contact_person || "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Phone</p>
            <p className="font-medium">{vendor.phone || "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium">{vendor.email || "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">GSTIN</p>
            <p className="font-medium">{vendor.gstin || "-"}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Total Purchased</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-semibold">{formatCurrency(summary.total_purchased)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-semibold">{formatCurrency(summary.total_paid)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Total Due</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-semibold text-destructive">{formatCurrency(summary.total_due)}</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pos">
        <TabsList>
          <TabsTrigger value="pos">Recent POs</TabsTrigger>
          <TabsTrigger value="payments">Recent Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="pos" className="rounded border p-3">
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
        <TabsContent value="payments" className="rounded border p-3">
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
