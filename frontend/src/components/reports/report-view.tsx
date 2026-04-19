"use client";

import { useMemo, useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { FileSpreadsheet, FileText } from "lucide-react";
import { ApiClientError } from "@/lib/api/api-client";

import { getReportByType } from "@/features/reports/api";
import type {
  ReportFilters,
  ReportResponse,
  ReportRow,
} from "@/features/reports/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { exportReportToPdf } from "@/lib/export/export-pdf";
import { exportReportToXlsx } from "@/lib/export/export-xlsx";
import { reportKeys } from "@/lib/react-query/report-keys";
import type { ReportConfig } from "@/lib/reports/report-config";

export type DatePreset = "last_7" | "last_30" | "custom";

export type ReportViewState = {
  preset: DatePreset;
  setPreset: (value: DatePreset) => void;
  customFrom: string;
  setCustomFrom: (value: string) => void;
  customTo: string;
  setCustomTo: (value: string) => void;
  filters: ReportFilters;
  hasValidDateRange: boolean;
  reportQuery: UseQueryResult<ReportResponse, Error>;
  rows: ReportRow[];
  dateRangeLabel: string;
};

type ReportViewProps = {
  config: ReportConfig;
  state: ReportViewState;
};

type UseReportViewStateParams = {
  enabled?: boolean;
};

function getReportErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.statusCode === 400) {
      return "Invalid report filters. Please verify the selected date range.";
    }

    if (error.statusCode === 409) {
      return "Report request conflicts with current data state. Refresh and try again.";
    }

    if (error.statusCode >= 500) {
      return "Server error while loading report data. Please try again shortly.";
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Failed to load report. Please try again.";
}

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getRangeForLastDays(days: number): ReportFilters {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));

  return {
    from: toInputDate(from),
    to: toInputDate(to),
  };
}

export function formatDateForLabel(dateString: string): string {
  if (!dateString) {
    return "-";
  }

  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isNumericValue(value: unknown): value is number {
  return typeof value === "number";
}

function cellText(value: ReportRow[string]): string | number {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return value;
}

function getReportQueryKey(config: ReportConfig, filters: ReportFilters) {
  if (config.key === "purchase") {
    return reportKeys.purchase(filters);
  }

  if (config.key === "inventory") {
    return reportKeys.inventory(filters);
  }

  return reportKeys.sales(filters);
}

export function useReportViewState(
  config: ReportConfig,
  params?: UseReportViewStateParams,
): ReportViewState {
  const isEnabled = params?.enabled ?? true;
  const [preset, setPreset] = useState<DatePreset>("last_7");
  const [customFrom, setCustomFrom] = useState(
    () => getRangeForLastDays(30).from,
  );
  const [customTo, setCustomTo] = useState(() => getRangeForLastDays(30).to);

  const filters = useMemo<ReportFilters>(() => {
    if (preset === "last_30") {
      return getRangeForLastDays(30);
    }

    if (preset === "custom") {
      return {
        from: customFrom,
        to: customTo,
      };
    }

    return getRangeForLastDays(7);
  }, [preset, customFrom, customTo]);

  const hasValidDateRange = Boolean(
    filters.from && filters.to && filters.from <= filters.to,
  );

  const reportQuery = useQuery({
    queryKey: getReportQueryKey(config, filters),
    queryFn: () => getReportByType(config.key, filters),
    enabled: isEnabled && hasValidDateRange,
    refetchOnWindowFocus: false,
  });

  const rows = useMemo(
    () => reportQuery.data?.rows ?? [],
    [reportQuery.data?.rows],
  );

  const dateRangeLabel = `${formatDateForLabel(filters.from)} to ${formatDateForLabel(filters.to)}`;

  return {
    preset,
    setPreset: (value) => setPreset(value),
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    filters,
    hasValidDateRange,
    reportQuery,
    rows,
    dateRangeLabel,
  };
}

export function ReportView({ config, state }: ReportViewProps) {
  const {
    preset,
    setPreset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    hasValidDateRange,
    reportQuery,
    rows,
    dateRangeLabel,
  } = state;

  const numericColumnKeys = useMemo(() => {
    const keys = new Set<string>();

    for (const column of config.columns) {
      if (rows.some((row) => isNumericValue(row[column.key]))) {
        keys.add(column.key);
      }
    }

    return keys;
  }, [config.columns, rows]);

  const exportPayload = {
    reportTitle: config.title,
    dateRangeLabel,
    columns: config.columns,
    rows,
    fileName: `${config.key}-report`,
  };

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <CardTitle>{config.title}</CardTitle>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={preset}
              onValueChange={(value) => setPreset(value as DatePreset)}
            >
              <SelectTrigger className="w-45">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_7">Last 7 days</SelectItem>
                <SelectItem value="last_30">Last 30 days</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>

            {preset === "custom" ? (
              <>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="w-40"
                />
                <Input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="w-40"
                />
              </>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                rows.length === 0 || reportQuery.isLoading || !hasValidDateRange
              }
              onClick={() => {
                void exportReportToXlsx(exportPayload);
              }}
            >
              <FileSpreadsheet className="size-4" />
              Export Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                rows.length === 0 || reportQuery.isLoading || !hasValidDateRange
              }
              onClick={() => {
                exportReportToPdf(exportPayload);
              }}
            >
              <FileText className="size-4" />
              Export PDF
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {hasValidDateRange ? null : (
          <div className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
            Please provide a valid custom date range.
          </div>
        )}

        {reportQuery.isLoading ? (
          <div className="rounded-lg border px-3 py-8 text-center text-sm text-muted-foreground">
            Loading report data...
          </div>
        ) : null}

        {reportQuery.isError ? (
          <div className="rounded-lg border px-3 py-8 text-center text-sm text-destructive">
            {getReportErrorMessage(reportQuery.error)}
          </div>
        ) : null}

        {!reportQuery.isLoading && !reportQuery.isError && rows.length === 0 ? (
          <div className="rounded-lg border px-3 py-8 text-center text-sm text-muted-foreground">
            No rows available for the selected date range.
          </div>
        ) : null}

        {!reportQuery.isLoading && !reportQuery.isError && rows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                {config.columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={
                      numericColumnKeys.has(column.key)
                        ? "text-right"
                        : "text-left"
                    }
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow key={`${config.key}-${rowIndex}`}>
                  {config.columns.map((column) => {
                    const value = row[column.key];

                    return (
                      <TableCell
                        key={`${config.key}-${rowIndex}-${column.key}`}
                        className={
                          numericColumnKeys.has(column.key)
                            ? "text-right"
                            : "text-left"
                        }
                      >
                        {cellText(value)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}
