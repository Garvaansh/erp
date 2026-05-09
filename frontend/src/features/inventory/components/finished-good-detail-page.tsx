"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, FileText } from "lucide-react";
import { exportReportToPdf } from "@/lib/export/export-pdf";
import { exportReportToXlsx } from "@/lib/export/export-xlsx";
import { useFinishedGoodDetail } from "@/features/inventory/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type FinishedGoodDetailPageProps = {
  productId: string;
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
  productId,
}: FinishedGoodDetailPageProps) {
  const router = useRouter();
  const detailQuery = useFinishedGoodDetail(productId);
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
            Aggregated stock, production batches, and manufacturing lineage.
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
          <div key={label} className="rounded-xl border bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border bg-background px-4 py-4">
        <h3 className="text-sm font-semibold text-foreground">Lineage</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Linked Raw Material
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
              Finished Batches
            </p>
            <p className="mt-1 text-sm font-medium">{detail.summary.batch_count}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Source Chains
            </p>
            <p className="mt-1 text-sm font-medium">
              {detail.source_molded_batches.length} molded /{" "}
              {detail.source_raw_batches.length} raw
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-background">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">
            Production Batches
          </h3>
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
              {detail.batches.map((row) => (
                <TableRow key={row.batch_id}>
                  <TableCell className="font-mono text-xs">
                    {row.batch_code}
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
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <LineageTable
          title="Recent Polishing Output"
          columns={["Finished Batch", "Source Molded", "Output Qty", "Operator"]}
          rows={detail.recent_polishing_output.map((row) => [
            row.finished_batch_code,
            row.source_molded_batch_code || "-",
            row.output_qty,
            row.operator_name || "-",
          ])}
        />
        <LineageTable
          title="Source Molded Batches"
          columns={["Batch Code", "Status", "Produced Qty", "Latest Used"]}
          rows={detail.source_molded_batches.map((row) => [
            row.batch_code,
            row.status,
            row.produced_qty?.toFixed(2) ?? "-",
            formatDate(row.latest_used_at || row.created_at),
          ])}
        />
        <LineageTable
          title="Source Raw Batches"
          columns={["Batch Code", "Vendor", "PO", "Latest Used"]}
          rows={detail.source_raw_batches.map((row) => [
            row.batch_code,
            row.vendor_name || "-",
            row.po_number || "-",
            formatDate(row.latest_used_at || row.created_at),
          ])}
        />
      </section>
    </div>
  );
}

function LineageTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <section className="rounded-xl border bg-background">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => (
                <TableRow key={`${title}-${rowIndex}`}>
                  {row.map((value, cellIndex) => (
                    <TableCell key={`${title}-${rowIndex}-${cellIndex}`}>
                      {value}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  No rows available.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
