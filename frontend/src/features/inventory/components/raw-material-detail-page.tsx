"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, Search } from "lucide-react";
import { exportReportToPdf } from "@/lib/export/export-pdf";
import { exportReportToXlsx } from "@/lib/export/export-xlsx";
import { formatMaterialLabel } from "@/lib/format-spec";
import { reverseReceipt } from "@/features/procurement/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUpdateRawMaterialBatchStatus, useUpdateRawMaterialThreshold } from "@/features/inventory/mutations";
import { useRawMaterialBatches, useRawMaterialSummary } from "@/features/inventory/queries";
import {
  parseRawMaterialBatchFilters,
  serializeRawMaterialBatchFilters,
} from "@/features/inventory/raw-material-filters";
import { inventoryKeys, procurementKeys } from "@/lib/react-query/keys";

type RawMaterialDetailPageProps = {
  itemId: string;
};

function formatKg(value: number): string {
  return `${value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} kg`;
}

function formatDate(value: string): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function batchStatusVariant(status: string) {
  switch (status) {
    case "ACTIVE":
      return "default" as const;
    case "HOLD":
      return "secondary" as const;
    case "REVERSED":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function batchDate(value: string): string {
  return value.slice(0, 10);
}

export function RawMaterialDetailPage({
  itemId,
}: RawMaterialDetailPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const summaryQuery = useRawMaterialSummary(itemId);
  const batchesQuery = useRawMaterialBatches(itemId);
  const updateBatchStatusMutation = useUpdateRawMaterialBatchStatus();
  const updateThresholdMutation = useUpdateRawMaterialThreshold();
  const reverseMutation = useMutation({
    mutationFn: ({ poId, batchId }: { poId: string; batchId: string }) =>
      reverseReceipt(poId, {
        batch_id: batchId,
        reason: "Reversed to vendor from raw material ledger",
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: inventoryKeys.rawMaterials() }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.rawMaterialSummary(itemId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.rawMaterialBatches(itemId),
        }),
        queryClient.invalidateQueries({ queryKey: procurementKeys.all }),
      ]);
    },
  });

  const [thresholdOpen, setThresholdOpen] = useState(false);
  const [thresholdDraft, setThresholdDraft] = useState("");

  const filters = useMemo(
    () => parseRawMaterialBatchFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const batches = batchesQuery.data ?? [];
  const summary = summaryQuery.data;

  const vendorOptions = useMemo(() => {
    const map = new Map<string, string>();
    batches.forEach((row) => {
      const vendorName = row.vendor_name?.trim();
      if (!vendorName) {
        return;
      }

      const key = vendorName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, vendorName);
      }
    });

    return Array.from(map.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [batches]);

  const filteredBatches = useMemo(() => {
    return batches.filter((row) => {
      if (filters.vendor && row.vendor_name?.toLowerCase() !== filters.vendor) {
        return false;
      }

      if (filters.status && row.status !== filters.status) {
        return false;
      }

      if (
        filters.batchCode &&
        !row.batch_code.toLowerCase().includes(filters.batchCode.toLowerCase())
      ) {
        return false;
      }

      const receivedDate = batchDate(row.received_at);
      if (filters.from && receivedDate < filters.from) {
        return false;
      }
      if (filters.to && receivedDate > filters.to) {
        return false;
      }

      return true;
    });
  }, [batches, filters]);

  if (summaryQuery.isLoading || batchesQuery.isLoading) {
    return (
      <div className="rounded-xl border bg-background px-4 py-6 text-sm text-muted-foreground">
        Loading raw material ledger...
      </div>
    );
  }

  if (!summary || summaryQuery.isError || batchesQuery.isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        Failed to load raw material detail.
      </div>
    );
  }

  function setFilter(next: Partial<typeof filters>) {
    const params = serializeRawMaterialBatchFilters({
      ...filters,
      ...next,
    });
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function openThresholdDialog() {
    setThresholdDraft(String(summary?.threshold ?? 0));
    setThresholdOpen(true);
  }

  async function handleThresholdSave() {
    const threshold = Number(thresholdDraft);
    if (!Number.isFinite(threshold) || threshold < 0) {
      return;
    }

    await updateThresholdMutation.mutateAsync({
      itemId,
      threshold,
    });
    setThresholdOpen(false);
  }

  function handleExportXlsx() {
    if (!summary) {
      return;
    }

    void exportReportToXlsx({
      reportTitle: "Batch Inventory Report",
      dateRangeLabel: "",
      fileName: `${summary.sku.toLowerCase()}-batch-inventory-report`,
      headerFields: [
        {
          label: "Material",
          value: formatMaterialLabel(summary.name, summary.specification),
        },
        { label: "SKU", value: summary.sku },
        { label: "Generated At", value: new Date().toLocaleString("en-IN") },
      ],
      columns: [
        { key: "batch_code", label: "Batch Code" },
        { key: "vendor_name", label: "Vendor" },
        { key: "po_number", label: "PO Reference" },
        { key: "received_at", label: "Received Date" },
        { key: "initial_qty", label: "Initial Qty" },
        { key: "remaining_qty", label: "Remaining Qty" },
        { key: "reserved_qty", label: "Reserved Qty" },
        { key: "available_qty", label: "Available Qty" },
        { key: "status", label: "Status" },
      ],
      rows: filteredBatches.map((row) => ({
        batch_code: row.batch_code,
        vendor_name: row.vendor_name ?? "-",
        po_number: row.po_number ?? "-",
        received_at: formatDate(row.received_at),
        initial_qty: row.initial_qty,
        remaining_qty: row.remaining_qty,
        reserved_qty: row.reserved_qty,
        available_qty: row.available_qty,
        status: row.status,
      })),
    });
  }

  function handleExportPdf() {
    if (!summary) {
      return;
    }

    exportReportToPdf({
      reportTitle: "Batch Inventory Report",
      dateRangeLabel: "",
      fileName: `${summary.sku.toLowerCase()}-batch-inventory-report`,
      headerFields: [
        {
          label: "Material",
          value: formatMaterialLabel(summary.name, summary.specification),
        },
        { label: "SKU", value: summary.sku },
        { label: "Generated At", value: new Date().toLocaleString("en-IN") },
      ],
      columns: [
        { key: "batch_code", label: "Batch Code" },
        { key: "vendor_name", label: "Vendor" },
        { key: "po_number", label: "PO Reference" },
        { key: "received_at", label: "Received Date" },
        { key: "initial_qty", label: "Initial Qty" },
        { key: "remaining_qty", label: "Remaining Qty" },
        { key: "reserved_qty", label: "Reserved Qty" },
        { key: "available_qty", label: "Available Qty" },
        { key: "status", label: "Status" },
      ],
      rows: filteredBatches.map((row) => ({
        batch_code: row.batch_code,
        vendor_name: row.vendor_name ?? "-",
        po_number: row.po_number ?? "-",
        received_at: formatDate(row.received_at),
        initial_qty: row.initial_qty,
        remaining_qty: row.remaining_qty,
        reserved_qty: row.reserved_qty,
        available_qty: row.available_qty,
        status: row.status,
      })),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push("/inventory/raw-materials")}>
          Back to Raw Materials
        </Button>
      </div>

      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">
              {summary.sku} | {summary.name} | {summary.specification || "-"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Batch ledger and procurement traceability for this raw material.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExportXlsx}>
              <FileSpreadsheet className="mr-2 size-4" />
              Export Excel
            </Button>
            <Button variant="outline" onClick={handleExportPdf}>
              <FileText className="mr-2 size-4" />
              Export PDF
            </Button>
            <Button variant="outline" onClick={openThresholdDialog}>
              Edit Threshold
            </Button>
          </div>
        </header>

      <section className="grid gap-3 md:grid-cols-5">
          {[
            ["Available Qty", formatKg(summary.available_qty)],
            ["Reserved Qty", formatKg(summary.reserved_qty)],
            ["HOLD Qty", formatKg(summary.hold_qty)],
            ["Pending Deliveries", formatKg(summary.pending_deliveries)],
            ["Threshold", formatKg(summary.threshold)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border bg-background px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <p className="mt-1 text-lg font-semibold">{value}</p>
            </div>
          ))}
        </section>

      <section className="rounded-xl border bg-background">
        <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.batchCode}
              onChange={(event) => setFilter({ batchCode: event.target.value })}
              placeholder="Search batch code"
              className="pl-9"
            />
          </div>

          <Select
            value={filters.vendor || "__ALL__"}
            onValueChange={(value) => {
              const nextVendor = value && value !== "__ALL__" ? value : "";
              setFilter({ vendor: nextVendor });
            }}
          >
            <SelectTrigger className="w-full lg:w-52">
              <SelectValue placeholder="All vendors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">All vendors</SelectItem>
              {vendorOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.status || "__ALL__"}
            onValueChange={(value) => {
              const nextStatus = value && value !== "__ALL__" ? value : "";
              setFilter({ status: nextStatus });
            }}
          >
            <SelectTrigger className="w-full lg:w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">All statuses</SelectItem>
              <SelectItem value="ACTIVE">ACTIVE</SelectItem>
              <SelectItem value="HOLD">HOLD</SelectItem>
              <SelectItem value="EXHAUSTED">EXHAUSTED</SelectItem>
              <SelectItem value="REVERSED">REVERSED</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={filters.from}
            onChange={(event) => setFilter({ from: event.target.value })}
            className="w-full lg:w-44"
          />
          <Input
            type="date"
            value={filters.to}
            onChange={(event) => setFilter({ to: event.target.value })}
            className="w-full lg:w-44"
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch Code</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>PO Reference</TableHead>
                <TableHead>Received Date</TableHead>
                <TableHead className="text-right">Initial Qty</TableHead>
                <TableHead className="text-right">Remaining Qty</TableHead>
                <TableHead className="text-right">Reserved Qty</TableHead>
                <TableHead className="text-right">Available Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBatches.map((row) => (
                <TableRow key={row.batch_id}>
                  <TableCell className="font-mono text-xs">
                    {row.batch_code}
                  </TableCell>
                  <TableCell>{row.vendor_name || "-"}</TableCell>
                  <TableCell>
                    {row.parent_po_id && row.po_number ? (
                      <Link
                        href={`/procurement/${row.parent_po_id}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {row.po_number}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{formatDate(row.received_at)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatKg(row.initial_qty)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatKg(row.remaining_qty)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatKg(row.reserved_qty)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatKg(row.available_qty)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={batchStatusVariant(row.status)}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {row.status === "ACTIVE" || row.status === "HOLD" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateBatchStatusMutation.mutate({
                              batchId: row.batch_id,
                              itemId,
                              payload: {
                                status: row.status === "ACTIVE" ? "HOLD" : "ACTIVE",
                              },
                            })
                          }
                        >
                          {row.status === "ACTIVE" ? "Place on HOLD" : "Reactivate"}
                        </Button>
                      ) : null}
                      {row.parent_po_id && row.status !== "REVERSED" ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            reverseMutation.mutate({
                              poId: row.parent_po_id!,
                              batchId: row.batch_id,
                            })
                          }
                        >
                          Reverse to Vendor
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {!batchesQuery.isLoading && filteredBatches.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No batches match the current filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={thresholdOpen} onOpenChange={setThresholdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Threshold</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="threshold">Threshold (kg)</Label>
            <Input
              id="threshold"
              type="number"
              min="0"
              step="0.01"
              value={thresholdDraft}
              onChange={(event) => setThresholdDraft(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setThresholdOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleThresholdSave()}>
              Save Threshold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

