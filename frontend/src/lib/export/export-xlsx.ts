import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

import {
  REPORT_EXPORT_STYLE,
  estimateColumnWidth,
  getColumnProfiles,
  normalizeFileName,
  toCellText,
  toHeaderLabel,
  type ExportReportInput,
} from "@/lib/export/report-export-style";

export type { ExportReportInput } from "@/lib/export/report-export-style";

export async function exportReportToXlsx({
  reportTitle,
  dateRangeLabel,
  columns,
  rows,
  fileName,
}: ExportReportInput): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Report", {
    views: [
      {
        state: "frozen",
        ySplit: REPORT_EXPORT_STYLE.spacing.excelFreezeRowCount,
      },
    ],
  });
  worksheet.properties.defaultRowHeight = REPORT_EXPORT_STYLE.spacing.excelBodyRowHeight;
  const columnCount = Math.max(columns.length, 1);
  const columnProfiles = getColumnProfiles(columns, rows);

  columns.forEach((column, index) => {
    const excelColumn = worksheet.getColumn(index + 1);
    const profile = columnProfiles[index];
    excelColumn.width = estimateColumnWidth(column, rows, profile);
    excelColumn.alignment = {
      horizontal: profile?.isNumeric ? "right" : "left",
      vertical: "middle",
      wrapText: false,
      shrinkToFit: false,
    };
  });

  const lastCol = worksheet.columns.length || columnCount;
  workbook.creator = "Reva Technologies";

  worksheet.mergeCells(1, 1, 1, lastCol);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = "Reva Technologies";
  titleCell.font = {
    name: REPORT_EXPORT_STYLE.fonts.primary,
    size: REPORT_EXPORT_STYLE.typography.titleSize,
    bold: true,
    color: { argb: REPORT_EXPORT_STYLE.colors.textPrimaryArgb },
  };
  worksheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 24;

  worksheet.mergeCells(2, 1, 2, lastCol);
  const subtitleCell = worksheet.getCell(2, 1);
  subtitleCell.value = `${reportTitle} | ${dateRangeLabel}`;
  subtitleCell.font = {
    name: REPORT_EXPORT_STYLE.fonts.primary,
    size: REPORT_EXPORT_STYLE.typography.subheaderSize,
    color: { argb: REPORT_EXPORT_STYLE.colors.textMutedArgb },
  };
  worksheet.getRow(2).alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(2).height = 20;

  worksheet.getRow(3).height = REPORT_EXPORT_STYLE.spacing.sectionGap;

  const headerRow = worksheet.getRow(
    REPORT_EXPORT_STYLE.spacing.excelHeaderRowIndex,
  );
  headerRow.values = columns.map((column) => toHeaderLabel(column.label));
  headerRow.height = REPORT_EXPORT_STYLE.spacing.excelHeaderRowHeight;
  headerRow.alignment = { vertical: "middle", horizontal: "left" };

  headerRow.eachCell((cell) => {
    cell.font = {
      name: REPORT_EXPORT_STYLE.fonts.primary,
      size: REPORT_EXPORT_STYLE.typography.tableHeaderSize,
      bold: true,
      color: { argb: REPORT_EXPORT_STYLE.colors.textPrimaryArgb },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: REPORT_EXPORT_STYLE.colors.headerFillArgb },
    };
    cell.border = {
      bottom: {
        style: "thin",
        color: { argb: REPORT_EXPORT_STYLE.colors.separatorArgb },
      },
    };
    cell.alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: false,
      shrinkToFit: false,
    };
  });

  rows.forEach((row) => {
    const rowValues = columns.map((column) => toCellText(row[column.key]));
    const addedRow = worksheet.addRow(rowValues);

    columns.forEach((column, index) => {
      const profile = columnProfiles[index];
      const cell = addedRow.getCell(index + 1);
      const rawValue = row[column.key];

      cell.font = {
        name: REPORT_EXPORT_STYLE.fonts.primary,
        size: REPORT_EXPORT_STYLE.typography.tableBodySize,
        bold: profile?.isNumeric ? true : undefined,
        color: { argb: REPORT_EXPORT_STYLE.colors.textPrimaryArgb },
      };
      cell.alignment = {
        horizontal: profile?.isNumeric ? "right" : "left",
        vertical: "middle",
        wrapText: false,
        shrinkToFit: false,
      };
      cell.border = {
        bottom: {
          style: "thin",
          color: { argb: REPORT_EXPORT_STYLE.colors.separatorArgb },
        },
      };

      if (profile?.isCurrency && typeof rawValue === "number") {
        cell.numFmt = REPORT_EXPORT_STYLE.excel.currencyNumFmt;
      }
    });
  });

  if (columns.length === 0) {
    worksheet.getColumn(1).width = 20;
  }

  const outputFileName = fileName ?? normalizeFileName(reportTitle);
  const buffer = await workbook.xlsx.writeBuffer();

  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${outputFileName}.xlsx`,
  );
}
