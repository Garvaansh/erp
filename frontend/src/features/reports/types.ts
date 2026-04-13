import type { ReportConfig } from "@/lib/reports/report-config";

export type ReportType = ReportConfig["key"];

export type ReportFilters = {
  from: string;
  to: string;
};

export type ReportValue = string | number | null;

export type ReportRow = Record<string, ReportValue>;

export type ReportSummary = Record<string, string | number>;

export type ReportResponse = {
  summary: ReportSummary;
  rows: ReportRow[];
};
