"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, FileText, ExternalLink } from "lucide-react";
import { exportReportToPdf } from "@/lib/export/export-pdf";
import { exportReportToXlsx } from "@/lib/export/export-xlsx";
import { useFinishedGoodDetail } from "@/features/inventory/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { getBatchDetailHref } from "@/lib/inventory/batch-routing";

type FinishedGoodDetailPageProps = {
  itemId: string;
};

function formatQuantity(value: number): string {
  return `${value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} kg`;
}

function formatDiameter(value: number): string {
  return `${value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} mm`;
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

export function FinishedGoodDetailPage({
  itemId,
}: FinishedGoodDetailPageProps) {
  const router = useRouter();
  const detailQuery = useFinishedGoodDetail(itemId);
  const detail = detailQuery.data;

  const exportRows = useMemo(() => {
    if (!detail) {
      return [];
    }

    return detail.batches.map((row) => ({
      batch_code: row.batch_code,
      created_at: formatDate(row.created_at),
      source_molded_batch_code: row.source_molded_batch_code ?? "-",
      initial_qty: row.initial_qty,
      remaining_qty: row.remaining_qty,
      reserved_qty: row.reserved_qty,
      available_qty: row.available_qty,
      status: row.status,
    }));
  }, [detail]);

  if (detailQuery.isLoading) {
    return (
      <div className="rounded-xl border bg-background px-4 py-6 text-sm text-muted-foreground">
        Loading finished good detail...
      </div>
    );
  }

  if (!detail || detailQuery.isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        Failed to load finished good detail.
      </div>
    );
  }

  function handleExportXlsx() {
    const currentDetail = detail;
    if (!currentDetail) {
      return;
    }

    void exportReportToXlsx({
      reportTitle: "Finished Goods Batch Report",
      dateRangeLabel: "",
      fileName: `${currentDetail.summary.sku.toLowerCase()}-finished-goods-report`,
      headerFields: [
        { label: "Product", value: currentDetail.summary.name },
        { label: "SKU", value: currentDetail.summary.sku },
        {
          label: "Diameter",
          value: formatDiameter(currentDetail.summary.diameter),
        },
        { label: "Generated At", value: new Date().toLocaleString("en-IN") },
      ],
      columns: [
        { key: "batch_code", label: "Finished Batch" },
        { key: "created_at", label: "Created At" },
        { key: "source_molded_batch_code", label: "Source Molded Batch" },
        { key: "initial_qty", label: "Initial Qty" },
        { key: "remaining_qty", label: "Remaining Qty" },
        { key: "reserved_qty", label: "Reserved Qty" },
        { key: "available_qty", label: "Available Qty" },
        { key: "status", label: "Status" },
      ],
      rows: exportRows,
    });
  }

  function handleExportPdf() {
    const currentDetail = detail;
    if (!currentDetail) {
      return;
    }

    exportReportToPdf({
      reportTitle: "Finished Goods Batch Report",
      dateRangeLabel: "",
      fileName: `${currentDetail.summary.sku.toLowerCase()}-finished-goods-report`,
      headerFields: [
        { label: "Product", value: currentDetail.summary.name },
        { label: "SKU", value: currentDetail.summary.sku },
        {
          label: "Diameter",
          value: formatDiameter(currentDetail.summary.diameter),
        },
        { label: "Generated At", value: new Date().toLocaleString("en-IN") },
      ],
      columns: [
        { key: "batch_code", label: "Finished Batch" },
        { key: "created_at", label: "Created At" },
        { key: "source_molded_batch_code", label: "Source Molded Batch" },
        { key: "initial_qty", label: "Initial Qty" },
        { key: "remaining_qty", label: "Remaining Qty" },
        { key: "reserved_qty", label: "Reserved Qty" },
        { key: "available_qty", label: "Available Qty" },
        { key: "status", label: "Status" },
      ],
      rows: exportRows,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => router.push("/inventory/finished-goods")}
        >
          Back to Finished Goods
        </Button>
      </div>

      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">
            {detail.summary.sku} | {detail.summary.name} |{" "}
            {formatDiameter(detail.summary.diameter)}
          </h2>
          <p className="text-sm text-muted-foreground">
            Inventory overview and batch status for this finished good.
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
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-5">
        {[
          ["Available Qty", formatQuantity(detail.summary.available_qty)],
          ["Reserved Qty", formatQuantity(detail.summary.reserved_qty)],
          ["HOLD Qty", formatQuantity(detail.summary.hold_qty)],
          ["Total Qty", formatQuantity(detail.summary.total_qty)],
          ["Status", detail.summary.status],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border bg-background px-4 py-3"
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border bg-background px-4 py-4">
        <h3 className="text-sm font-semibold text-foreground">
          Linked Raw Material
        </h3>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Raw Material
            </p>
            <p className="mt-1 text-sm font-medium">
              {detail.summary.linked_raw_material_sku || "-"} |{" "}
              {detail.summary.linked_raw_material_name || "-"}
            </p>
            <p className="text-xs text-muted-foreground">
              {detail.summary.linked_raw_material_specification || "-"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Diameter
            </p>
            <p className="mt-1 text-sm font-medium">
              {formatDiameter(detail.summary.diameter)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Active Batches
            </p>
            <p className="mt-1 text-sm font-medium">
              {detail.summary.batch_count}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Low Stock Threshold
            </p>
            <p className="mt-1 text-sm font-medium">
              {detail.summary.low_stock_threshold
                ? formatQuantity(detail.summary.low_stock_threshold)
                : "Not set"}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-background">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">
            Production Batches
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Open a batch code to review its manufacturing flow and stock history.
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch Code</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Source Molded Batch</TableHead>
                <TableHead className="text-right">Initial Qty</TableHead>
                <TableHead className="text-right">Remaining Qty</TableHead>
                <TableHead className="text-right">Reserved Qty</TableHead>
                <TableHead className="text-right">Available Qty</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.batches.length > 0 ? (
                detail.batches.map((row) => (
                  <TableRow
                    key={row.batch_id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() =>
                      router.push(
                        getBatchDetailHref("FINISHED", row.batch_code),
                      )
                    }
                  >
                    <TableCell className="font-mono text-xs">
                      <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                        {row.batch_code}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(row.created_at)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.source_molded_batch_code || "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatQuantity(row.initial_qty)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatQuantity(row.remaining_qty)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatQuantity(row.reserved_qty)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatQuantity(row.available_qty)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={batchStatusVariant(row.status)}>
                        {row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    No batches available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <hr className="my-6 border-border" />

      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Polishing Output</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Operator</TableHead>
                  <TableHead className="text-right">Output Qty</TableHead>
                  <TableHead className="text-right">Yield</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.recent_polishing_output?.length > 0 ? (
                  detail.recent_polishing_output.map((row) => {
                    const o = Number(row.output_qty) || 0;
                    const s = Number(row.scrap_qty) || 0;
                    const sl = Number(row.shortlength_qty) || 0;
                    const pl = Number(row.process_loss_qty) || 0;
                    const total = o + s + sl + pl;
                    const yieldPct = total > 0 ? `${((o / total) * 100).toFixed(1)}%` : "-";
                    return (
                      <TableRow key={row.journal_id}>
                        <TableCell>{formatDate(row.created_at)}</TableCell>
                        <TableCell>{row.operator_name || "-"}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatQuantity(o)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{yieldPct}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      No recent polishing output.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Molded Inputs Used</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Produced Qty</TableHead>
                  <TableHead>Latest Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.source_molded_batches?.length > 0 ? (
                  detail.source_molded_batches.map((row) => (
                    <TableRow key={row.batch_id}>
                      <TableCell className="font-mono text-xs">
                        <span
                          className="inline-flex cursor-pointer items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                          onClick={() =>
                            router.push(getBatchDetailHref("MOLDED", row.batch_code))
                          }
                        >
                          {row.batch_code}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={batchStatusVariant(row.status)}>{row.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatQuantity(row.produced_qty || 0)}</TableCell>
                      <TableCell>{formatDate(row.latest_used_at || "")}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      No source molded batches found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Raw Materials Used</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Code</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>PO</TableHead>
                  <TableHead>Latest Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.source_raw_batches?.length > 0 ? (
                  detail.source_raw_batches.map((row) => (
                    <TableRow key={row.batch_id}>
                      <TableCell className="font-mono text-xs">
                        <span
                          className="inline-flex cursor-pointer items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                          onClick={() =>
                            router.push(getBatchDetailHref("RAW", row.batch_code))
                          }
                        >
                          {row.batch_code}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                        </span>
                      </TableCell>
                      <TableCell>{row.vendor_name || "-"}</TableCell>
                      <TableCell>{row.po_number || "-"}</TableCell>
                      <TableCell>{formatDate(row.latest_used_at || "")}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      No source raw batches found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
