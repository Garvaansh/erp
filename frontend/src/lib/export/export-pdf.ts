import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { ReportColumn } from "@/lib/reports/report-config";
import type { ReportRow } from "@/features/reports/types";

export type ExportReportInput = {
  reportTitle: string;
  dateRangeLabel: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  fileName?: string;
};

function normalizeFileName(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toCellText(
  value: string | number | null | undefined,
): string | number {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return value;
}

export function exportReportToPdf({
  reportTitle,
  dateRangeLabel,
  columns,
  rows,
  fileName,
}: ExportReportInput): void {
  const doc = new jsPDF({
    orientation: columns.length > 8 ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.text("Reva Technologies", pageWidth / 2, 40, { align: "center" });

  doc.setFontSize(12);
  doc.text(reportTitle, 40, 72);

  doc.setFontSize(10);
  doc.text(dateRangeLabel, 40, 88);

  autoTable(doc, {
    startY: 104,
    head: [columns.map((column) => column.label)],
    body: rows.map((row) =>
      columns.map((column) => toCellText(row[column.key])),
    ),
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 6,
      halign: "left",
    },
    headStyles: {
      fillColor: [233, 236, 239],
      textColor: [33, 37, 41],
      fontStyle: "bold",
    },
  });

  const outputFileName = fileName ?? normalizeFileName(reportTitle);
  doc.save(`${outputFileName}.pdf`);
}
