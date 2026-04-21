import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  REPORT_EXPORT_STYLE,
  getColumnProfiles,
  normalizeFileName,
  resolvePdfFontFamily,
  toCellText,
  toHeaderLabel,
  type ExportReportInput,
} from "@/lib/export/report-export-style";

export type { ExportReportInput } from "@/lib/export/report-export-style";

export function exportReportToPdf({
  reportTitle,
  dateRangeLabel,
  columns,
  rows,
  fileName,
}: ExportReportInput): void {
  const doc = new jsPDF({
    orientation: columns.length > 7 ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });

  const columnProfiles = getColumnProfiles(columns, rows);
  const pdfFontFamily = resolvePdfFontFamily(
    typeof doc.getFontList === "function"
      ? () => doc.getFontList() as Record<string, string[]>
      : undefined,
  );

  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont(pdfFontFamily, "bold");
  doc.setFontSize(REPORT_EXPORT_STYLE.typography.titleSize);
  doc.setTextColor(...REPORT_EXPORT_STYLE.colors.textPrimaryRgb);
  if (typeof doc.setCharSpace === "function") {
    doc.setCharSpace(REPORT_EXPORT_STYLE.typography.titleLetterSpacing);
  }

  doc.text(
    "Reva Technologies",
    pageWidth / 2,
    REPORT_EXPORT_STYLE.spacing.pdfTopY,
    { align: "center" },
  );
  doc.text(
    reportTitle,
    pageWidth / 2,
    REPORT_EXPORT_STYLE.spacing.pdfReportTitleY,
    { align: "center" },
  );

  doc.setFont(pdfFontFamily, "normal");
  doc.setFontSize(REPORT_EXPORT_STYLE.typography.subheaderSize);
  doc.setTextColor(...REPORT_EXPORT_STYLE.colors.textMutedRgb);
  if (typeof doc.setCharSpace === "function") {
    doc.setCharSpace(0);
  }
  doc.text(
    dateRangeLabel,
    pageWidth / 2,
    REPORT_EXPORT_STYLE.spacing.pdfSubheaderY,
    { align: "center" },
  );

  doc.setLineHeightFactor(REPORT_EXPORT_STYLE.typography.tableBodyLineHeight);

  autoTable(doc, {
    startY: REPORT_EXPORT_STYLE.spacing.pdfTableStartY,
    margin: {
      left: REPORT_EXPORT_STYLE.pdf.margin.left,
      right: REPORT_EXPORT_STYLE.pdf.margin.right,
      bottom: REPORT_EXPORT_STYLE.pdf.margin.bottom,
    },
    head: [columns.map((column) => toHeaderLabel(column.label))],
    body: rows.map((row) =>
      columns.map((column) => toCellText(row[column.key])),
    ),
    theme: "plain",
    tableWidth: "auto",
    styles: {
      font: pdfFontFamily,
      fontSize: REPORT_EXPORT_STYLE.typography.tableBodySize,
      cellPadding: REPORT_EXPORT_STYLE.pdf.cellPadding,
      halign: "left",
      valign: "middle",
      overflow: "linebreak",
      lineWidth: {
        top: 0,
        right: 0,
        bottom: 0.1,
        left: 0,
      },
      lineColor: REPORT_EXPORT_STYLE.colors.separatorRgb,
      textColor: REPORT_EXPORT_STYLE.colors.textPrimaryRgb,
    },
    headStyles: {
      fillColor: REPORT_EXPORT_STYLE.colors.headerFillRgb,
      textColor: REPORT_EXPORT_STYLE.colors.textPrimaryRgb,
      fontSize: REPORT_EXPORT_STYLE.typography.tableHeaderSize,
      fontStyle: "bold",
      lineWidth: {
        top: 0,
        right: 0,
        bottom: 0.2,
        left: 0,
      },
      lineColor: REPORT_EXPORT_STYLE.colors.separatorRgb,
    },
    didParseCell: (hook) => {
      const profile = columnProfiles[hook.column.index];
      if (!profile) {
        return;
      }

      if (hook.section === "head") {
        hook.cell.styles.halign = profile.isNumeric ? "right" : "left";
        return;
      }

      hook.cell.styles.halign = profile.isNumeric ? "right" : "left";
      if (profile.isNumeric) {
        hook.cell.styles.fontStyle = "bold";
      }
    },
  });

  const outputFileName = fileName ?? normalizeFileName(reportTitle);
  doc.save(`${outputFileName}.pdf`);
}
