"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
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
import { MoneyDisplay } from "@/components/common/money-display";
import { useLedger } from "@/hooks/useLedger";
import { exportReportToXlsx } from "@/lib/export/export-xlsx";
import { exportReportToPdf } from "@/lib/export/export-pdf";
import type { LedgerEntry, LedgerTypeFilter } from "@/types/finance";

type DatePreset = "last_7" | "last_30" | "custom";

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRangeForLastDays(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from: toInputDate(from), to: toInputDate(to) };
}

function formatDateLabel(dateString: string): string {
  if (!dateString) return "-";
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatLedgerDate(raw: string): string {
  if (!raw) return "-";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const LEDGER_COLUMNS = [
  { key: "date", label: "Date" },
  { key: "tx_id", label: "Transaction ID" },
  { key: "party_name", label: "Party" },
  { key: "reference_number", label: "Reference" },
  { key: "amount", label: "Amount" },
  { key: "type", label: "Type" },
  { key: "note", label: "Note" },
] as const;

function TypeBadge({ type }: { type: "IN" | "OUT" }) {
  if (type === "OUT") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
        <ArrowUpCircle className="size-3" />
        OUT
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
      <ArrowDownCircle className="size-3" />
      IN
    </span>
  );
}

export function LedgerTab() {
  const [preset, setPreset] = useState<DatePreset>("last_30");
  const [customFrom, setCustomFrom] = useState(
    () => getRangeForLastDays(30).from,
  );
  const [customTo, setCustomTo] = useState(() => getRangeForLastDays(30).to);
  const [typeFilter, setTypeFilter] = useState<LedgerTypeFilter>("ALL");

  const dateRange = useMemo(() => {
    if (preset === "last_7") return getRangeForLastDays(7);
    if (preset === "custom") return { from: customFrom, to: customTo };
    return getRangeForLastDays(30);
  }, [preset, customFrom, customTo]);

  const hasValidRange = Boolean(
    dateRange.from && dateRange.to && dateRange.from <= dateRange.to,
  );

  const ledgerQuery = useLedger(
    hasValidRange
      ? { from_date: dateRange.from, to_date: dateRange.to }
      : undefined,
  );

  const filteredEntries = useMemo(() => {
    if (typeFilter === "ALL") return ledgerQuery.data;
    return ledgerQuery.data.filter((entry) => entry.type === typeFilter);
  }, [ledgerQuery.data, typeFilter]);

  const dateRangeLabel = `${formatDateLabel(dateRange.from)} to ${formatDateLabel(dateRange.to)}`;

  const exportRows = useMemo(
    () =>
      filteredEntries.map((entry) => ({
        date: formatLedgerDate(entry.date),
        tx_id: entry.tx_id,
        party_name: entry.party_name,
        reference_number: entry.reference_number,
        amount: entry.amount,
        type: entry.type,
        note: entry.note,
      })),
    [filteredEntries],
  );

  const exportPayload = {
    reportTitle: "Finance Ledger",
    dateRangeLabel,
    columns: LEDGER_COLUMNS.map((col) => ({ key: col.key, label: col.label })),
    rows: exportRows,
    fileName: "finance-ledger",
  };

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <CardTitle>Transaction Ledger</CardTitle>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={typeFilter}
              onValueChange={(value) =>
                setTypeFilter(value as LedgerTypeFilter)
              }
            >
              <SelectTrigger className="w-28" id="ledger-type-filter">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="IN">Inflow</SelectItem>
                <SelectItem value="OUT">Outflow</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={preset}
              onValueChange={(value) => setPreset(value as DatePreset)}
            >
              <SelectTrigger className="w-40" id="ledger-date-preset">
                <SelectValue placeholder="Date range" />
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
                  id="ledger-from-date"
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="w-40"
                />
                <Input
                  id="ledger-to-date"
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
              disabled={filteredEntries.length === 0 || ledgerQuery.isLoading}
              onClick={() => {
                void exportReportToXlsx(exportPayload);
              }}
            >
              <FileSpreadsheet className="size-4" />
              Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={filteredEntries.length === 0 || ledgerQuery.isLoading}
              onClick={() => {
                exportReportToPdf(exportPayload);
              }}
            >
              <FileText className="size-4" />
              PDF
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!hasValidRange ? (
          <div className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
            Please provide a valid custom date range.
          </div>
        ) : null}

        {ledgerQuery.isLoading ? (
          <div className="rounded-lg border px-3 py-8 text-center text-sm text-muted-foreground">
            Loading ledger entries…
          </div>
        ) : null}

        {ledgerQuery.isError ? (
          <div className="rounded-lg border px-3 py-8 text-center text-sm text-destructive">
            Unable to load ledger data. Please try again.
          </div>
        ) : null}

        {!ledgerQuery.isLoading &&
        !ledgerQuery.isError &&
        filteredEntries.length === 0 ? (
          <div className="rounded-lg border px-3 py-8 text-center text-sm text-muted-foreground">
            No ledger entries for the selected filters.
          </div>
        ) : null}

        {!ledgerQuery.isLoading &&
        !ledgerQuery.isError &&
        filteredEntries.length > 0 ? (
          <LedgerTable entries={filteredEntries} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function LedgerTable({ entries }: { entries: LedgerEntry[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Transaction</TableHead>
          <TableHead>Party</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Note</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.tx_id}>
            <TableCell className="whitespace-nowrap">
              {formatLedgerDate(entry.date)}
            </TableCell>
            <TableCell className="max-w-[120px] truncate font-mono text-xs">
              {entry.tx_id.slice(0, 8)}…
            </TableCell>
            <TableCell>{entry.party_name || "-"}</TableCell>
            <TableCell className="font-mono text-xs">
              {entry.reference_number}
            </TableCell>
            <TableCell className="text-right">
              <MoneyDisplay amount={entry.amount} />
            </TableCell>
            <TableCell>
              <TypeBadge type={entry.type} />
            </TableCell>
            <TableCell className="max-w-[160px] truncate text-muted-foreground">
              {entry.note || "-"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
