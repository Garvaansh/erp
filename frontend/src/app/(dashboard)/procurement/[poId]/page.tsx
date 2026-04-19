"use client";

import { type FormEvent, use, useState } from "react";
import Link from "next/link";
import { Loader2, PenLine } from "lucide-react";
import { ApiClientError } from "@/lib/api/api-client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUpdatePurchaseOrder } from "@/features/procurement/mutations";
import { useProcurementDetail } from "@/features/procurement/queries";
import type {
  InventoryBatch,
  ProcurementLog,
  ProcurementPaymentInputStatus,
  ProcurementPaymentStatus,
  ProcurementStatus,
} from "@/features/procurement/types";

type ProcurementDetailPageProps = {
  params: Promise<{
    poId: string;
  }>;
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const quantityFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatQty(value: number): string {
  return quantityFormatter.format(value);
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString();
}

function getStatusVariant(
  status: ProcurementStatus,
): "default" | "secondary" | "outline" {
  if (status === "PENDING") {
    return "outline";
  }

  if (status === "PARTIAL") {
    return "secondary";
  }

  return "default";
}

function formatDeliveryStatusLabel(status: ProcurementStatus): string {
  switch (status) {
    case "PENDING":
      return "Pending Receipt";
    case "PARTIAL":
      return "Partial Receipt";
    case "COMPLETED":
      return "Fully Received";
    case "CLOSED":
      return "Closed";
    default:
      return status;
  }
}

function formatPaymentStatusLabel(
  status: ProcurementPaymentStatus | undefined,
): string {
  switch ((status ?? "UNPAID").toUpperCase()) {
    case "PENDING":
    case "UNPAID":
      return "Unpaid";
    case "PARTIAL":
      return "Partial Payment";
    case "COMPLETED":
    case "PAID":
      return "Paid in Full";
    default:
      return "Unpaid";
  }
}

function toPaymentInputStatus(
  status: ProcurementPaymentStatus | undefined,
): ProcurementPaymentInputStatus {
  switch ((status ?? "UNPAID").toUpperCase()) {
    case "COMPLETED":
    case "PAID":
      return "COMPLETED";
    case "PARTIAL":
      return "PARTIAL";
    case "PENDING":
    case "UNPAID":
    default:
      return "PENDING";
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    if (error.statusCode === 400) {
      return error.message || "Invalid request. Please review input and retry.";
    }
    if (error.statusCode === 409) {
      return error.message || "Data changed on server. Refresh and try again.";
    }
    if (error.statusCode >= 500) {
      return fallback;
    }
    return error.message || fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function getMutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    if (error.statusCode === 400) {
      return error.message || "Please review your input and try again.";
    }
    if (error.statusCode === 409) {
      return error.message || "Request conflicts with current order state.";
    }
    if (error.statusCode >= 500) {
      return fallback;
    }
    return error.message || fallback;
  }

  return getErrorMessage(error, fallback);
}

function readNumberField(value: unknown, key: string): number | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const raw = (value as Record<string, unknown>)[key];
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }

  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function readStringField(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const raw = (value as Record<string, unknown>)[key];
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }

  return undefined;
}

function batchName(batch: InventoryBatch, index: number): string {
  if (batch.batch_code && batch.batch_code.trim()) {
    return batch.batch_code;
  }

  return `Batch ${index + 1}`;
}

function canEditPurchaseOrder(status: ProcurementStatus): boolean {
  return status === "PENDING" || status === "PARTIAL";
}

function formatVendorDisplay(name: string, shortName?: string): string {
  const normalizedShort = shortName?.trim();
  if (!normalizedShort) {
    return name;
  }

  return `${name} (${normalizedShort})`;
}

export default function ProcurementDetailPage({
  params,
}: ProcurementDetailPageProps) {
  const { poId } = use(params);
  const detailQuery = useProcurementDetail(poId);
  const updateMutation = useUpdatePurchaseOrder();

  const [editOpen, setEditOpen] = useState(false);
  const [editUnitPrice, setEditUnitPrice] = useState("");
  const [editVendorInvoiceRef, setEditVendorInvoiceRef] = useState("");
  const [editPaymentStatus, setEditPaymentStatus] =
    useState<ProcurementPaymentInputStatus>("PENDING");
  const [editNotes, setEditNotes] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editError, setEditError] = useState("");

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Link
          href="/procurement"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Back to Procurement
        </Link>
        <div className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
          Loading procurement details...
        </div>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="space-y-4">
        <Link
          href="/procurement"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Back to Procurement
        </Link>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            {getErrorMessage(
              detailQuery.error,
              "Failed to load procurement detail.",
            )}
          </p>
        </div>
      </div>
    );
  }

  const { po, batches, logs } = detailQuery.data;
  const remainingQty = Math.max(po.ordered_qty - po.received_qty, 0);
  const totalValue = po.total_value ?? po.ordered_qty * po.unit_price;
  const paidAmount =
    po.paid_amount ?? Math.max(totalValue - (po.due_amount ?? totalValue), 0);
  const dueAmount = po.due_amount ?? Math.max(totalValue - paidAmount, 0);
  const paymentDisplayStatus =
    po.payment_status ??
    (paidAmount <= 0 ? "UNPAID" : dueAmount > 0 ? "PARTIAL" : "PAID");
  const canEdit = canEditPurchaseOrder(po.status);

  const visibleBatches = batches.items.filter(
    (batch) => (batch.status ?? "").toUpperCase() !== "REVERSED",
  );

  const logItems: ProcurementLog[] = logs.items.length
    ? logs.items
    : logs.last_action
      ? [logs.last_action]
      : [];

  function openEditDialog() {
    setEditUnitPrice(String(po.unit_price));
    setEditVendorInvoiceRef(po.vendor_invoice_ref ?? "");
    setEditPaymentStatus(toPaymentInputStatus(po.payment_status));
    setEditNotes(po.notes ?? "");
    setEditReason("");
    setEditError("");
    setEditOpen(true);
  }

  function handleEditOpenChange(open: boolean) {
    if (!open && updateMutation.isPending) {
      return;
    }

    if (!open) {
      setEditError("");
      setEditReason("");
    }

    setEditOpen(open);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditError("");

    if (updateMutation.isPending) {
      return;
    }

    const unitPrice = Number(editUnitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      setEditError("Price per unit must be greater than zero.");
      return;
    }

    const reason = editReason.trim();
    if (!reason) {
      setEditError("Reason for edit is required.");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: po.id,
        payload: {
          unit_price: unitPrice,
          vendor_invoice_ref: editVendorInvoiceRef,
          payment_status: editPaymentStatus,
          notes: editNotes,
          edit_reason: reason,
        },
      });

      setEditOpen(false);
    } catch (error) {
      setEditError(
        getMutationErrorMessage(error, "Failed to update purchase order."),
      );
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{po.po_number}</h1>
          <p className="text-sm text-muted-foreground">
            Vendor: {formatVendorDisplay(po.vendor_name, po.vendor_short_name)}{" "}
            • Item: {po.item_name}
            {po.item_sku ? ` • SKU: ${po.item_sku}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">Item ID: {po.item_id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusVariant(po.status)}>
            {formatDeliveryStatusLabel(po.status)}
          </Badge>
          <Badge variant="outline">
            {formatPaymentStatusLabel(paymentDisplayStatus)}
          </Badge>
          {canEdit ? (
            <Button variant="outline" size="sm" onClick={openEditDialog}>
              <PenLine className="mr-2 h-4 w-4" />
              Edit
            </Button>
          ) : null}
          <Link
            href="/procurement"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Back to Procurement
          </Link>
        </div>
      </header>

      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          PO Summary
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Ordered Qty</dt>
            <dd className="font-medium">{formatQty(po.ordered_qty)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Received Qty</dt>
            <dd className="font-medium">{formatQty(po.received_qty)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Remaining Qty</dt>
            <dd className="font-medium">{formatQty(remainingQty)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Unit Price</dt>
            <dd className="font-medium">{formatCurrency(po.unit_price)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last Action</dt>
            <dd className="font-medium">{po.last_action ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Delivery Status</dt>
            <dd className="font-medium">
              {formatDeliveryStatusLabel(po.status)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last Action Time</dt>
            <dd className="font-medium">{formatDateTime(po.last_action_at)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Created</dt>
            <dd className="font-medium">{formatDateTime(po.created_at)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Updated</dt>
            <dd className="font-medium">{formatDateTime(po.updated_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Vendor Details
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Vendor</dt>
            <dd className="font-medium">
              {po.vendor_id ? (
                <Link
                  href={`/vendors/${po.vendor_id}`}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {formatVendorDisplay(po.vendor_name, po.vendor_short_name)}
                </Link>
              ) : (
                formatVendorDisplay(po.vendor_name, po.vendor_short_name)
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Vendor Code</dt>
            <dd className="font-medium">{po.vendor_code ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Contact Person</dt>
            <dd className="font-medium">{po.vendor_contact_person ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Phone</dt>
            <dd className="font-medium">{po.vendor_phone ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Vendor Invoice Ref</dt>
            <dd className="font-medium">{po.vendor_invoice_ref ?? "-"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Payment Summary
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Payment Status</dt>
            <dd className="font-medium">
              {formatPaymentStatusLabel(paymentDisplayStatus)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Total Value</dt>
            <dd className="font-medium">{formatCurrency(totalValue)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Paid Amount</dt>
            <dd className="font-medium">{formatCurrency(paidAmount)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Due Amount</dt>
            <dd className="font-medium">{formatCurrency(dueAmount)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border bg-background p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Batches</h2>
          <p className="text-xs text-muted-foreground">
            Total {batches.total} • Active {batches.active} • Reversed{" "}
            {batches.reversed}
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch ID</TableHead>
              <TableHead>Initial Qty</TableHead>
              <TableHead>Remaining Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Unit Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleBatches.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  {batches.reversed > 0
                    ? "All receipt batches were reversed. See activity logs for the audit trail."
                    : "No batch records available for this purchase order."}
                </TableCell>
              </TableRow>
            ) : (
              visibleBatches.map((batch, index) => {
                const initialQty = readNumberField(batch, "initial_qty");
                const remaining = readNumberField(batch, "remaining_qty");
                const unitCost = readNumberField(batch, "unit_cost");
                const status = readStringField(batch, "status") ?? "-";

                return (
                  <TableRow key={batch.batch_id}>
                    <TableCell className="font-medium">
                      {batchName(batch, index)}
                    </TableCell>
                    <TableCell>
                      {typeof initialQty === "number"
                        ? formatQty(initialQty)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {typeof remaining === "number"
                        ? formatQty(remaining)
                        : "-"}
                    </TableCell>
                    <TableCell>{status}</TableCell>
                    <TableCell>
                      {typeof unitCost === "number"
                        ? formatCurrency(unitCost)
                        : "-"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Activity Logs
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-8 text-center text-muted-foreground"
                >
                  No activity logs available yet.
                </TableCell>
              </TableRow>
            ) : (
              logItems.map((log, index) => (
                <TableRow
                  key={`${log.action}-${log.created_at ?? "na"}-${index}`}
                >
                  <TableCell>{formatDateTime(log.created_at)}</TableCell>
                  <TableCell className="font-medium">{log.action}</TableCell>
                  <TableCell>{log.note ?? "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <Dialog open={editOpen} onOpenChange={handleEditOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit Purchase Order</DialogTitle>
              <DialogDescription>
                Update allowed procurement fields and provide a reason for audit
                tracking.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Ordered Qty</Label>
                <Input value={formatQty(po.ordered_qty)} readOnly disabled />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-unit-price">Price Per Unit</Label>
                <Input
                  id="edit-unit-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editUnitPrice}
                  onChange={(event) => setEditUnitPrice(event.target.value)}
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="edit-vendor-invoice-ref">
                  Vendor Invoice Ref
                </Label>
                <Input
                  id="edit-vendor-invoice-ref"
                  value={editVendorInvoiceRef}
                  onChange={(event) =>
                    setEditVendorInvoiceRef(event.target.value)
                  }
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Payment Status</Label>
                <Input
                  value={formatPaymentStatusLabel(editPaymentStatus)}
                  readOnly
                  disabled
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={editNotes}
                  onChange={(event) => setEditNotes(event.target.value)}
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="edit-reason">Reason for Edit *</Label>
                <Textarea
                  id="edit-reason"
                  value={editReason}
                  onChange={(event) => setEditReason(event.target.value)}
                  disabled={updateMutation.isPending}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Transaction ID</Label>
                <Input value={po.transaction_id} readOnly disabled />
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Input
                  value={formatDeliveryStatusLabel(po.status)}
                  readOnly
                  disabled
                />
              </div>

              <div className="space-y-1.5">
                <Label>Received Qty</Label>
                <Input value={formatQty(po.received_qty)} readOnly disabled />
              </div>

              <div className="space-y-1.5">
                <Label>Vendor</Label>
                <Input value={po.vendor_name} readOnly disabled />
              </div>
            </div>

            {editError ? (
              <p className="text-sm text-destructive">{editError}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleEditOpenChange(false)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
