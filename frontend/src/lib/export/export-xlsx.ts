import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

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

export async function exportReportToXlsx({
  reportTitle,
  dateRangeLabel,
  columns,
  rows,
  fileName,
}: ExportReportInput): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Report");
  const columnCount = Math.max(columns.length, 1);

  worksheet.mergeCells(1, 1, 1, columnCount);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = "Reva Technologies";
  titleCell.font = { size: 18, bold: true };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  worksheet.mergeCells(2, 1, 2, columnCount);
  const subtitleCell = worksheet.getCell(2, 1);
  subtitleCell.value = `${reportTitle} | ${dateRangeLabel}`;
  subtitleCell.font = { size: 12 };
  subtitleCell.alignment = { horizontal: "center", vertical: "middle" };

  worksheet.getRow(3).height = 8;

  const headerRow = worksheet.getRow(4);
  headerRow.values = columns.map((column) => column.label);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };

  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE9ECEF" },
    };
  });

  rows.forEach((row) => {
    const rowValues = columns.map((column) => toCellText(row[column.key]));
    const addedRow = worksheet.addRow(rowValues);
    addedRow.alignment = { vertical: "middle" };
  });

  worksheet.columns.forEach((excelColumn, index) => {
    const column = columns[index];
    if (!column) {
      excelColumn.width = 20;
      return;
    }

    const values = rows.map((row) => row[column.key]);
    const maxLength = Math.max(
      column.label.length,
      ...values.map((value) => String(toCellText(value)).length),
    );

    excelColumn.width = Math.min(Math.max(maxLength + 2, 12), 40);

    const hasNumericValue = values.some((value) => typeof value === "number");
    excelColumn.alignment = {
      horizontal: hasNumericValue ? "right" : "left",
      vertical: "middle",
    };
  });

  const outputFileName = fileName ?? normalizeFileName(reportTitle);
  const buffer = await workbook.xlsx.writeBuffer();

  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${outputFileName}.xlsx`,
  );
}
