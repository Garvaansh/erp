"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ApiClientError } from "@/lib/api/api-client";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  useCloseOrder,
  useCreatePurchaseOrder,
  useReceiveGoods,
  useReverseReceipt,
} from "@/features/procurement/mutations";
import {
  useProcurementDetail,
  useProcurementList,
  useProcurementMaterialOptions,
} from "@/features/procurement/queries";
import { getVendors } from "@/features/vendors/api";
import type {
  InventoryBatch,
  ProcurementMaterialOption,
  ProcurementPaymentStatus,
  ProcurementStatus,
  PurchaseOrder,
} from "@/features/procurement/types";
import type { Vendor } from "@/features/vendors/types";
import { vendorsKeys } from "@/lib/react-query/keys";

type TabValue = "pending" | "recent";
type StatusFilter = "ALL" | ProcurementStatus;

const REVERSE_ALL_BATCHES_VALUE = "__ALL_BATCHES__";

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

function getRemainingQty(order: PurchaseOrder): number {
  return Math.max(order.ordered_qty - order.received_qty, 0);
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

function batchLabel(batch: InventoryBatch, index: number): string {
  if (batch.batch_code && batch.batch_code.trim()) {
    return batch.batch_code;
  }

  return `Batch ${index + 1}`;
}

function looksLikeUUID(value: string): boolean {
  const trimmed = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    trimmed,
  );
}

function filterRows(
  rows: PurchaseOrder[],
  search: string,
  status: StatusFilter,
): PurchaseOrder[] {
  const searchTerm = search.trim().toLowerCase();

  return rows.filter((row) => {
    if (status !== "ALL" && row.status !== status) {
      return false;
    }

    if (!searchTerm) {
      return true;
    }

    const haystack = [
      row.po_number,
      row.vendor_name,
      row.item_name,
      row.item_sku,
      row.transaction_id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(searchTerm);
  });
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    if (error.statusCode === 400) {
      return (
        error.message || "Invalid request. Please review filters and retry."
      );
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
      return error.message || "Please review your input and retry.";
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

export default function ProcurementPage() {
  const router = useRouter();
  const listQuery = useProcurementList();
  const materialsQuery = useProcurementMaterialOptions();
  const vendorsQuery = useQuery({
    queryKey: vendorsKeys.list(),
    queryFn: getVendors,
  });

  const createMutation = useCreatePurchaseOrder();
  const receiveMutation = useReceiveGoods();
  const reverseMutation = useReverseReceipt();
  const closeMutation = useCloseOrder();

  const [activeTab, setActiveTab] = useState<TabValue>("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [createQty, setCreateQty] = useState("");
  const [createUnitPrice, setCreateUnitPrice] = useState("");
  const [createVendorInvoiceRef, setCreateVendorInvoiceRef] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createError, setCreateError] = useState("");

  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(
    null,
  );
  const [receiveQty, setReceiveQty] = useState("");
  const [receiveError, setReceiveError] = useState("");

  const [reverseTarget, setReverseTarget] = useState<PurchaseOrder | null>(
    null,
  );
  const [reverseBatchId, setReverseBatchId] = useState("");
  const [reverseReason, setReverseReason] = useState("");
  const [reverseError, setReverseError] = useState("");
  const [reverseConfirmOpen, setReverseConfirmOpen] = useState(false);

  const [closeTarget, setCloseTarget] = useState<PurchaseOrder | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [closeError, setCloseError] = useState("");
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  const reverseDetailQuery = useProcurementDetail(
    reverseTarget?.id ?? "",
    Boolean(reverseTarget),
  );

  const pendingRows = listQuery.data?.pending;
  const recentRows = listQuery.data?.recent;

  const filteredPending = useMemo(
    () => filterRows(pendingRows ?? [], searchTerm, statusFilter),
    [pendingRows, searchTerm, statusFilter],
  );

  const filteredRecent = useMemo(
    () => filterRows(recentRows ?? [], searchTerm, statusFilter),
    [recentRows, searchTerm, statusFilter],
  );

  const materialOptions: ProcurementMaterialOption[] = useMemo(
    () => materialsQuery.data ?? [],
    [materialsQuery.data],
  );

  const activeVendors: Vendor[] = useMemo(
    () => (vendorsQuery.data ?? []).filter((vendor) => vendor.is_active),
    [vendorsQuery.data],
  );

  const itemLabelById = useMemo(() => {
    const map = new Map<string, string>();
    const allRows = [...(pendingRows ?? []), ...(recentRows ?? [])];
    allRows.forEach((row) => {
      const withSku = row.item_sku?.trim()
        ? `${row.item_name} (${row.item_sku})`
        : row.item_name;
      if (row.item_id && withSku.trim()) {
        map.set(row.item_id, withSku.trim());
      }
    });
    return map;
  }, [pendingRows, recentRows]);

  const materialSelectOptions = useMemo(
    () =>
      materialOptions.map((option) => ({
        ...option,
        displayLabel:
          option.label.trim() && !looksLikeUUID(option.label)
            ? option.label
            : (itemLabelById.get(option.item_id) ?? option.item_id),
      })),
    [materialOptions, itemLabelById],
  );

  const reverseBatches = useMemo(
    () =>
      (reverseDetailQuery.data?.batches.items ?? []).filter(
        (batch) => (batch.status ?? "").toUpperCase() !== "REVERSED",
      ),
    [reverseDetailQuery.data?.batches.items],
  );

  const selectedMaterialValue = selectedMaterialId;
  const selectedVendorValue = selectedVendorId;
  const reverseBatchValue =
    reverseBatchId ||
    (reverseBatches.length > 1
      ? REVERSE_ALL_BATCHES_VALUE
      : reverseBatches[0]?.batch_id || "");

  function resetCreateForm() {
    setSelectedVendorId("");
    setCreateQty("");
    setCreateUnitPrice("");
    setCreateVendorInvoiceRef("");
    setCreateNotes("");
    setCreateError("");
    setSelectedMaterialId("");
  }

  function openCreateDialog() {
    resetCreateForm();
    setCreateOpen(true);
  }

  function closeCreateDialog(open: boolean) {
    if (!open && createMutation.isPending) {
      return;
    }

    if (!open) {
      resetCreateForm();
    }
    setCreateOpen(open);
  }

  function openReceiveDialog(order: PurchaseOrder) {
    setReceiveTarget(order);
    setReceiveQty("");
    setReceiveError("");
  }

  function closeReceiveDialog(open: boolean) {
    if (!open && !receiveMutation.isPending) {
      setReceiveTarget(null);
      setReceiveQty("");
      setReceiveError("");
    }
  }

  function openReverseDialog(order: PurchaseOrder) {
    setReverseTarget(order);
    setReverseBatchId("");
    setReverseReason("");
    setReverseError("");
  }

  function closeReverseDialog(open: boolean) {
    if (!open && !reverseMutation.isPending) {
      setReverseTarget(null);
      setReverseBatchId("");
      setReverseReason("");
      setReverseError("");
      setReverseConfirmOpen(false);
    }
  }

  function openCloseDialog(order: PurchaseOrder) {
    setCloseTarget(order);
    setCloseReason("");
    setCloseError("");
  }

  function closeCloseDialog(open: boolean) {
    if (!open && !closeMutation.isPending) {
      setCloseTarget(null);
      setCloseReason("");
      setCloseError("");
      setCloseConfirmOpen(false);
    }
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (createMutation.isPending) {
      return;
    }

    setCreateError("");

    const selectedVendor = activeVendors.find(
      (vendor) => vendor.id === selectedVendorValue,
    );
    const materialID = selectedMaterialValue;
    const orderedQty = Number(createQty);
    const unitPrice = Number(createUnitPrice);
    const vendorInvoiceRef = createVendorInvoiceRef.trim();
    const notes = createNotes.trim();

    if (!materialID) {
      setCreateError("Select a material before creating the PO.");
      return;
    }

    if (!selectedVendorValue || !selectedVendor) {
      setCreateError("Select a vendor before creating the PO.");
      return;
    }

    if (!Number.isFinite(orderedQty) || orderedQty <= 0) {
      setCreateError("Quantity must be greater than zero.");
      return;
    }

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      setCreateError("Unit price must be greater than zero.");
      return;
    }

    try {
      await createMutation.mutateAsync({
        item_id: materialID,
        vendor_id: selectedVendor.id,
        vendor_name: selectedVendor.name,
        ordered_qty: orderedQty,
        unit_price: unitPrice,
        vendor_invoice_ref: vendorInvoiceRef || undefined,
        notes: notes || undefined,
      });

      closeCreateDialog(false);
    } catch (error) {
      setCreateError(
        getMutationErrorMessage(
          error,
          "Unable to create purchase order right now.",
        ),
      );
    }
  }

  async function handleReceiveSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (receiveMutation.isPending) {
      return;
    }

    setReceiveError("");

    if (!receiveTarget) {
      return;
    }

    const qty = Number(receiveQty);
    const remainingQty = getRemainingQty(receiveTarget);

    if (!Number.isFinite(qty) || qty <= 0) {
      setReceiveError("Received quantity must be greater than zero.");
      return;
    }

    if (qty > remainingQty) {
      setReceiveError("Received quantity cannot exceed remaining quantity.");
      return;
    }

    try {
      await receiveMutation.mutateAsync({
        id: receiveTarget.id,
        payload: { qty },
      });

      closeReceiveDialog(false);
    } catch (error) {
      setReceiveError(
        getMutationErrorMessage(error, "Unable to receive stock right now."),
      );
    }
  }

  async function handleReverseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (reverseMutation.isPending) {
      return;
    }

    setReverseError("");

    if (!reverseTarget) {
      return;
    }

    const reason = reverseReason.trim();

    if (!reverseBatchValue) {
      setReverseError("Select a batch to reverse.");
      return;
    }

    if (!reason) {
      setReverseError("Reason is required to reverse a receipt.");
      return;
    }

    const targetBatchIDs =
      reverseBatchValue === REVERSE_ALL_BATCHES_VALUE
        ? Array.from(new Set(reverseBatches.map((batch) => batch.batch_id)))
        : [reverseBatchValue];

    if (targetBatchIDs.length === 0) {
      setReverseError("No batches are available for reversal.");
      return;
    }

    setReverseConfirmOpen(true);
  }

  async function handleCloseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (closeMutation.isPending) {
      return;
    }

    setCloseError("");

    if (!closeTarget) {
      return;
    }

    const reason = closeReason.trim();
    if (!reason) {
      setCloseError("Reason is required to close an order.");
      return;
    }

    setCloseConfirmOpen(true);
  }

  async function handleConfirmReverse() {
    if (!reverseTarget || reverseMutation.isPending) {
      return;
    }

    const reason = reverseReason.trim();
    const targetBatchIDs =
      reverseBatchValue === REVERSE_ALL_BATCHES_VALUE
        ? Array.from(new Set(reverseBatches.map((batch) => batch.batch_id)))
        : [reverseBatchValue];

    try {
      await reverseMutation.mutateAsync({
        id: reverseTarget.id,
        payload:
          targetBatchIDs.length > 1
            ? {
                batch_ids: targetBatchIDs,
                reason,
              }
            : {
                batch_id: targetBatchIDs[0],
                reason,
              },
      });

      setReverseConfirmOpen(false);
      closeReverseDialog(false);
    } catch (error) {
      setReverseConfirmOpen(false);
      setReverseError(
        getMutationErrorMessage(error, "Unable to reverse receipt right now."),
      );
    }
  }

  async function handleConfirmClose() {
    if (!closeTarget || closeMutation.isPending) {
      return;
    }

    const reason = closeReason.trim();

    try {
      await closeMutation.mutateAsync({
        id: closeTarget.id,
        payload: { reason },
      });

      setCloseConfirmOpen(false);
      closeCloseDialog(false);
    } catch (error) {
      setCloseConfirmOpen(false);
      setCloseError(
        getMutationErrorMessage(
          error,
          "Unable to close purchase order right now.",
        ),
      );
    }
  }

  const actionMutationPending =
    receiveMutation.isPending ||
    reverseMutation.isPending ||
    closeMutation.isPending;

  function renderTableRows(rows: PurchaseOrder[]) {
    if (rows.length === 0) {
      return (
        <TableRow>
          <TableCell
            colSpan={8}
            className="py-8 text-center text-muted-foreground"
          >
            No purchase orders match the current filters.
          </TableCell>
        </TableRow>
      );
    }

    return rows.map((row) => {
      const remainingQty = getRemainingQty(row);
      const hasReceiptBatches =
        typeof row.total_batches === "number"
          ? row.total_batches > 0
          : row.received_qty > 0;
      const allowReceive =
        row.status !== "COMPLETED" && row.status !== "CLOSED";
      const allowClose = row.status === "PARTIAL" && row.received_qty > 0;
      const allowReverse = row.status !== "CLOSED" && hasReceiptBatches;

      return (
        <TableRow
          key={row.id}
          className="cursor-pointer"
          onClick={() => router.push(`/procurement/${row.id}`)}
        >
          <TableCell className="font-medium">{row.po_number}</TableCell>
          <TableCell>
            <div className="font-medium">{row.vendor_name}</div>
            <div className="text-xs text-muted-foreground">{row.item_name}</div>
            <div className="text-xs text-muted-foreground">
              Payment: {formatPaymentStatusLabel(row.payment_status)}
            </div>
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatQty(row.received_qty)} / {formatQty(row.ordered_qty)}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatQty(remainingQty)}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatCurrency(row.unit_price)}
          </TableCell>
          <TableCell>
            <Badge variant={getStatusVariant(row.status)}>
              {formatDeliveryStatusLabel(row.status)}
            </Badge>
          </TableCell>
          <TableCell>
            {formatDateTime(row.updated_at ?? row.created_at)}
          </TableCell>
          <TableCell>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={actionMutationPending}
                onClick={(event) => {
                  event.stopPropagation();
                  router.push(`/procurement/${row.id}`);
                }}
              >
                View
              </Button>
              {allowReceive ? (
                <Button
                  size="sm"
                  disabled={actionMutationPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    openReceiveDialog(row);
                  }}
                >
                  Receive
                </Button>
              ) : null}
              {allowReverse ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actionMutationPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    openReverseDialog(row);
                  }}
                >
                  Reverse
                </Button>
              ) : null}
              {allowClose ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={actionMutationPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    openCloseDialog(row);
                  }}
                >
                  Close
                </Button>
              ) : null}
            </div>
          </TableCell>
        </TableRow>
      );
    });
  }

  const activeCount =
    activeTab === "pending" ? filteredPending.length : filteredRecent.length;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Procurement Control Panel</h1>
          <p className="text-sm text-muted-foreground">
            Manage purchase orders, receiving, reversals, and closures from one
            table-first workflow.
          </p>
        </div>
        <Button onClick={openCreateDialog} disabled={createMutation.isPending}>
          + New PO
        </Button>
      </header>

      <section className="rounded-xl border bg-background p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by PO number, vendor, item, or transaction"
            aria-label="Search purchase orders"
          />
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="PENDING">PENDING</SelectItem>
              <SelectItem value="PARTIAL">PARTIAL</SelectItem>
              <SelectItem value="COMPLETED">COMPLETED</SelectItem>
              <SelectItem value="CLOSED">CLOSED</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center justify-end text-sm text-muted-foreground">
            Showing {activeCount} orders
          </div>
        </div>

        {listQuery.isLoading ? (
          <div className="py-8 text-sm text-muted-foreground">
            Loading procurement orders...
          </div>
        ) : null}

        {listQuery.isError ? (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="text-destructive">
              {getErrorMessage(
                listQuery.error,
                "Failed to load procurement orders.",
              )}
            </p>
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => listQuery.refetch()}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : null}

        {!listQuery.isLoading && !listQuery.isError ? (
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as TabValue)}
          >
            <TabsList variant="line" className="mt-4 w-full justify-start">
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="recent">Recent</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="pt-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">
                      Received / Ordered
                    </TableHead>
                    <TableHead className="text-right">Remaining Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead>Delivery Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{renderTableRows(filteredPending)}</TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="recent" className="pt-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">
                      Received / Ordered
                    </TableHead>
                    <TableHead className="text-right">Remaining Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead>Delivery Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{renderTableRows(filteredRecent)}</TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        ) : null}
      </section>

      <Dialog open={createOpen} onOpenChange={closeCreateDialog}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Create Purchase Order</DialogTitle>
              <DialogDescription>
                Create a new PO directly from the control panel.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Material</Label>
                <Select
                  value={selectedMaterialValue}
                  onValueChange={(value) => setSelectedMaterialId(value ?? "")}
                  disabled={
                    materialsQuery.isLoading ||
                    materialSelectOptions.length === 0
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        materialsQuery.isLoading
                          ? "Loading materials..."
                          : materialSelectOptions.length > 0
                            ? "Select material"
                            : "No materials available"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {materialSelectOptions.map((option) => (
                      <SelectItem key={option.item_id} value={option.item_id}>
                        {option.displayLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Vendor</Label>
                <Select
                  value={selectedVendorValue}
                  onValueChange={(value) => setSelectedVendorId(value ?? "")}
                  disabled={
                    vendorsQuery.isLoading || activeVendors.length === 0
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        vendorsQuery.isLoading
                          ? "Loading vendors..."
                          : activeVendors.length > 0
                            ? "Select vendor"
                            : "No active vendors available"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {activeVendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name.trim() || vendor.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-vendor-invoice-ref">
                  Vendor Invoice Number (Optional)
                </Label>
                <Input
                  id="create-vendor-invoice-ref"
                  value={createVendorInvoiceRef}
                  onChange={(event) =>
                    setCreateVendorInvoiceRef(event.target.value)
                  }
                  placeholder="INV-2026-8891"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-qty">Quantity</Label>
                <Input
                  id="create-qty"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={createQty}
                  onChange={(event) => setCreateQty(event.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-unit-price">Unit Price</Label>
                <Input
                  id="create-unit-price"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={createUnitPrice}
                  onChange={(event) => setCreateUnitPrice(event.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="create-notes">Notes (Optional)</Label>
                <Textarea
                  id="create-notes"
                  value={createNotes}
                  onChange={(event) => setCreateNotes(event.target.value)}
                  placeholder="Additional context for procurement team"
                />
              </div>
            </div>

            {createError ? (
              <p className="text-sm text-destructive">{createError}</p>
            ) : null}

            {materialsQuery.isError ? (
              <p className="text-sm text-destructive">
                {getErrorMessage(
                  materialsQuery.error,
                  "Failed to load selectable materials.",
                )}
              </p>
            ) : null}

            {vendorsQuery.isError ? (
              <p className="text-sm text-destructive">
                {getErrorMessage(vendorsQuery.error, "Failed to load vendors.")}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => closeCreateDialog(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createMutation.isPending ||
                  materialSelectOptions.length === 0 ||
                  activeVendors.length === 0
                }
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create PO"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(receiveTarget)} onOpenChange={closeReceiveDialog}>
        <DialogContent>
          <form onSubmit={handleReceiveSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Receive Goods</DialogTitle>
              <DialogDescription>
                {receiveTarget
                  ? `Record received quantity for ${receiveTarget.po_number}.`
                  : "Record received quantity."}
              </DialogDescription>
            </DialogHeader>

            {receiveTarget ? (
              <div className="rounded-lg border p-3 text-sm">
                <div>
                  Remaining Qty: {formatQty(getRemainingQty(receiveTarget))}
                </div>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="receive-qty">Received Qty</Label>
              <Input
                id="receive-qty"
                type="number"
                min="0"
                step="0.01"
                required
                value={receiveQty}
                onChange={(event) => setReceiveQty(event.target.value)}
                placeholder="0"
              />
            </div>

            {receiveError ? (
              <p className="text-sm text-destructive">{receiveError}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => closeReceiveDialog(false)}
                disabled={receiveMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={receiveMutation.isPending}>
                {receiveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Receiving...
                  </>
                ) : (
                  "Submit Receive"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reverseTarget)} onOpenChange={closeReverseDialog}>
        <DialogContent>
          <form onSubmit={handleReverseSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Reverse Receipt</DialogTitle>
              <DialogDescription>
                {reverseTarget
                  ? `Reverse received inventory for ${reverseTarget.po_number}.`
                  : "Reverse received inventory."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label>Batch</Label>
              <Select
                value={reverseBatchValue}
                onValueChange={(value) => setReverseBatchId(value ?? "")}
                disabled={
                  reverseDetailQuery.isLoading ||
                  reverseBatches.length === 0 ||
                  reverseMutation.isPending
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      reverseDetailQuery.isLoading
                        ? "Loading batches..."
                        : "Select batch"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {reverseBatches.length > 1 ? (
                    <SelectItem value={REVERSE_ALL_BATCHES_VALUE}>
                      All Batches (reverse all receipts)
                    </SelectItem>
                  ) : null}
                  {reverseBatches.map((batch, index) => (
                    <SelectItem key={batch.batch_id} value={batch.batch_id}>
                      {batchLabel(batch, index)} - Remaining{" "}
                      {formatQty(batch.remaining_qty ?? 0)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!reverseDetailQuery.isLoading && reverseBatches.length > 0 ? (
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Available Receipt Batches
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch</TableHead>
                      <TableHead className="text-right">
                        Remaining Qty
                      </TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reverseBatches.map((batch, index) => (
                      <TableRow key={`reverse-batch-${batch.batch_id}`}>
                        <TableCell className="font-medium">
                          {batchLabel(batch, index)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatQty(batch.remaining_qty ?? 0)}
                        </TableCell>
                        <TableCell>{batch.status ?? "ACTIVE"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="reverse-reason">Reason</Label>
              <Textarea
                id="reverse-reason"
                value={reverseReason}
                onChange={(event) => setReverseReason(event.target.value)}
                placeholder="Why are you reversing this receipt?"
                required
              />
            </div>

            {reverseDetailQuery.isError ? (
              <p className="text-sm text-destructive">
                {getErrorMessage(
                  reverseDetailQuery.error,
                  "Failed to load batch list.",
                )}
              </p>
            ) : null}

            {!reverseDetailQuery.isLoading &&
            !reverseDetailQuery.isError &&
            reverseBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No reversible batches are available for this order.
              </p>
            ) : null}

            {reverseError ? (
              <p className="text-sm text-destructive">{reverseError}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => closeReverseDialog(false)}
                disabled={reverseMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  reverseMutation.isPending ||
                  reverseDetailQuery.isLoading ||
                  reverseBatches.length === 0
                }
              >
                {reverseMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Reversing...
                  </>
                ) : reverseBatchValue === REVERSE_ALL_BATCHES_VALUE ? (
                  "Continue Reverse All"
                ) : (
                  "Continue Reverse"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reverseConfirmOpen}
        onOpenChange={(open) => {
          if (!reverseMutation.isPending) {
            setReverseConfirmOpen(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Reverse Receipt</DialogTitle>
            <DialogDescription>
              This will reverse received quantity and adjust inventory history.
              Please confirm to continue.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReverseConfirmOpen(false)}
              disabled={reverseMutation.isPending}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmReverse()}
              disabled={reverseMutation.isPending}
            >
              {reverseMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Reversing...
                </>
              ) : (
                "Confirm Reverse"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(closeTarget)} onOpenChange={closeCloseDialog}>
        <DialogContent>
          <form onSubmit={handleCloseSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Close Purchase Order</DialogTitle>
              <DialogDescription>
                {closeTarget
                  ? `Close ${closeTarget.po_number} and prevent further receipts.`
                  : "Close purchase order."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="close-reason">Reason</Label>
              <Textarea
                id="close-reason"
                value={closeReason}
                onChange={(event) => setCloseReason(event.target.value)}
                placeholder="Why is this order being closed?"
                required
              />
            </div>

            {closeError ? (
              <p className="text-sm text-destructive">{closeError}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => closeCloseDialog(false)}
                disabled={closeMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={closeMutation.isPending}
              >
                {closeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Closing...
                  </>
                ) : (
                  "Continue Close"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={closeConfirmOpen}
        onOpenChange={(open) => {
          if (!closeMutation.isPending) {
            setCloseConfirmOpen(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Close Order</DialogTitle>
            <DialogDescription>
              Closing an order prevents further receiving on this PO. Please
              confirm to continue.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCloseConfirmOpen(false)}
              disabled={closeMutation.isPending}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmClose()}
              disabled={closeMutation.isPending}
            >
              {closeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Closing...
                </>
              ) : (
                "Confirm Close"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
