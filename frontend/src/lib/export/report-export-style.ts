import type { ReportRow, ReportValue } from "@/features/reports/types";
import type { ReportColumn } from "@/lib/reports/report-config";

export type ExportReportInput = {
  reportTitle: string;
  dateRangeLabel: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  fileName?: string;
};

export type ReportColumnProfile = {
  isNumeric: boolean;
  isCurrency: boolean;
};

export const REPORT_EXPORT_STYLE = {
  fonts: {
    primary: "Inter",
    fallbacks: ["system-ui", "Segoe UI", "Roboto"],
    pdfFallback: "helvetica",
  },
  typography: {
    titleSize: 17,
    subheaderSize: 12,
    tableHeaderSize: 12,
    tableBodySize: 11,
    tableBodyLineHeight: 1.5,
    titleLetterSpacing: 0.35,
    headerLetterSpacing: 0.35,
  },
  spacing: {
    sectionGap: 18,
    excelFreezeRowCount: 1,
    excelHeaderRowIndex: 4,
    excelBodyRowHeight: 20,
    excelHeaderRowHeight: 22,
    pdfTopY: 42,
    pdfReportTitleY: 64,
    pdfSubheaderY: 84,
    pdfTableStartY: 112,
  },
  colors: {
    textPrimaryRgb: [33, 37, 41] as const,
    textMutedRgb: [108, 117, 125] as const,
    textPrimaryArgb: "FF212529",
    textMutedArgb: "FF6C757D",
    headerFillRgb: [245, 247, 250] as const,
    headerFillArgb: "FFF5F7FA",
    separatorRgb: [224, 229, 236] as const,
    separatorArgb: "FFE0E5EC",
  },
  excel: {
    minColumnWidth: 12,
    maxColumnWidth: 72,
    widthPaddingChars: 2,
    currencyNumFmt: "\u20B9#,##0.00",
  },
  pdf: {
    margin: {
      left: 42,
      right: 42,
      bottom: 44,
    },
    cellPadding: {
      top: 4,
      right: 6,
      bottom: 5,
      left: 6,
    },
  },
} as const;

const NUMERIC_COLUMN_HINT =
  /(amount|value|total|cost|price|qty|quantity|balance|rate|count|stock|tax|discount)/i;
const CURRENCY_COLUMN_HINT =
  /(amount|value|total|cost|price|balance|payable|receivable)/i;

export function normalizeFileName(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function toCellText(value: ReportValue): string | number {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "string") {
    return value.replace(/\r?\n|\r/g, " ");
  }

  return value;
}

export function toHeaderLabel(label: string): string {
  return label.toUpperCase();
}

export function getColumnProfiles(
  columns: ReportColumn[],
  rows: ReportRow[],
): ReportColumnProfile[] {
  return columns.map((column) => {
    const hasNumericValue = rows.some(
      (row) => typeof row[column.key] === "number",
    );
    const keyOrLabel = `${column.key} ${column.label}`;
    const hintedNumeric = NUMERIC_COLUMN_HINT.test(keyOrLabel);
    const isNumeric = hasNumericValue || hintedNumeric;
    const isCurrency = isNumeric && CURRENCY_COLUMN_HINT.test(keyOrLabel);

    return { isNumeric, isCurrency };
  });
}

export function estimateColumnWidth(
  column: ReportColumn,
  rows: ReportRow[],
  profile: ReportColumnProfile,
): number {
  const headerLength = toHeaderLabel(column.label).length;
  const longestCellLength = rows.reduce((max, row) => {
    const value = row[column.key];
    const text = formatCellForWidth(value, profile.isCurrency);
    return Math.max(max, text.length);
  }, 0);

  const rawWidth =
    Math.max(headerLength, longestCellLength) +
    REPORT_EXPORT_STYLE.excel.widthPaddingChars;

  return Math.min(
    Math.max(rawWidth, REPORT_EXPORT_STYLE.excel.minColumnWidth),
    REPORT_EXPORT_STYLE.excel.maxColumnWidth,
  );
}

export function resolvePdfFontFamily(
  getFontList: (() => Record<string, string[]>) | undefined,
): string {
  if (!getFontList) {
    return REPORT_EXPORT_STYLE.fonts.pdfFallback;
  }

  const fontList = getFontList();
  const availableFonts = new Set(
    Object.keys(fontList).map((fontName) => fontName.toLowerCase()),
  );

  const candidates = [
    REPORT_EXPORT_STYLE.fonts.primary,
    ...REPORT_EXPORT_STYLE.fonts.fallbacks,
    REPORT_EXPORT_STYLE.fonts.pdfFallback,
  ];

  const matched = candidates.find((fontName) =>
    availableFonts.has(fontName.toLowerCase()),
  );

  return matched ?? REPORT_EXPORT_STYLE.fonts.pdfFallback;
}

function formatCellForWidth(value: ReportValue, asCurrency: boolean): string {
  const normalized = toCellText(value);
  if (typeof normalized === "number") {
    if (asCurrency) {
      return `\u20B9${new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(normalized)}`;
    }

    return String(normalized);
  }

  return String(normalized);
}
