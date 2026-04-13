"use client";

import { useMemo, useState } from "react";
import {
  ChartColumnBig,
  PackageSearch,
  ShoppingCart,
  Truck,
  TrendingUp,
  CalendarDays,
  Lightbulb,
} from "lucide-react";

import {
  ReportView,
  useReportViewState,
} from "@/components/reports/report-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReportRow, ReportSummary } from "@/features/reports/types";
import { REPORTS, type ReportConfig } from "@/lib/reports/report-config";

type InsightPoint = {
  label: string;
  value: number;
};

const REPORT_TABS = [
  { key: "inventory", label: "Inventory", icon: PackageSearch },
  { key: "purchase", label: "Purchase", icon: Truck },
  { key: "sales", label: "Sales", icon: ShoppingCart },
] as const;

function toNumber(value: ReportRow[string]): number {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: ReportRow[string]): string {
  if (typeof value === "string") {
    return value;
  }

  return String(value ?? "-");
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function formatSummaryLabel(key: string): string {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function groupRows(
  rows: ReportRow[],
  labelSelector: (row: ReportRow) => string,
  valueSelector: (row: ReportRow) => number,
): InsightPoint[] {
  const grouped = new Map<string, number>();

  for (const row of rows) {
    const label = labelSelector(row);
    const value = valueSelector(row);
    grouped.set(label, (grouped.get(label) ?? 0) + value);
  }

  return [...grouped.entries()].map(([label, value]) => ({ label, value }));
}

function MiniBars({ points }: { points: InsightPoint[] }) {
  const sorted = [...points].sort((a, b) => a.label.localeCompare(b.label));
  const max = Math.max(...sorted.map((point) => point.value), 1);

  if (sorted.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No chart data for selected range.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((point) => (
        <div key={point.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate pr-2">{point.label}</span>
            <span className="font-mono text-foreground">{formatNumber(point.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-linear-to-r from-primary to-cyan-500"
              style={{ width: `${Math.max((point.value / max) * 100, 2)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryCards({ summary }: { summary: ReportSummary }) {
  const entries = Object.entries(summary);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {entries.map(([key, value]) => (
        <Card key={key} size="sm" className="erp-card-static bg-card">
          <CardContent className="space-y-1">
            <p className="text-xs text-muted-foreground">{formatSummaryLabel(key)}</p>
            <p className="text-lg font-semibold text-foreground">{String(value)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function InsightsSection({
  config,
  rows,
  summary,
  isLoading,
  isError,
}: {
  config: ReportConfig;
  rows: ReportRow[];
  summary: ReportSummary;
  isLoading: boolean;
  isError: boolean;
}) {
  const timeline = useMemo(() => {
    const valueKey = config.key === "inventory" ? "quantity" : "total_amount";
    return groupRows(
      rows,
      (row) => toText(row.date),
      (row) => toNumber(row[valueKey]),
    ).sort((a, b) => a.label.localeCompare(b.label));
  }, [config.key, rows]);

  const distribution = useMemo(() => {
    if (config.key === "inventory") {
      return groupRows(
        rows,
        (row) => toText(row.warehouse),
        (row) => toNumber(row.quantity),
      )
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
    }

    if (config.key === "purchase") {
      return groupRows(
        rows,
        (row) => toText(row.vendor),
        (row) => toNumber(row.total_amount),
      )
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
    }

    return groupRows(
      rows,
      (row) => toText(row.channel),
      (row) => toNumber(row.total_amount),
    )
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [config.key, rows]);

  const highlights = useMemo(() => {
    if (rows.length === 0) {
      return ["No insights available for the selected period."];
    }

    if (config.key === "inventory") {
      const topSku = [...rows].sort(
        (a, b) => toNumber(b.quantity) - toNumber(a.quantity),
      )[0];
      const avgUnitCost =
        rows.reduce((sum, row) => sum + toNumber(row.unit_cost), 0) / rows.length;

      return [
        `Top moving SKU: ${toText(topSku?.sku)} (${formatNumber(toNumber(topSku?.quantity))}).`,
        `Average unit cost in range: ${formatNumber(avgUnitCost)}.`,
      ];
    }

    if (config.key === "purchase") {
      const pendingCount = rows.filter((row) =>
        toText(row.status).toLowerCase().includes("pending"),
      ).length;
      const topVendor = [...distribution].sort((a, b) => b.value - a.value)[0];

      return [
        `Pending purchase orders: ${pendingCount}.`,
        `Top vendor by spend: ${topVendor?.label ?? "-"} (${formatNumber(topVendor?.value ?? 0)}).`,
      ];
    }

    const topCustomer = [...rows].sort(
      (a, b) => toNumber(b.total_amount) - toNumber(a.total_amount),
    )[0];
    const directRevenue = rows
      .filter((row) => toText(row.channel).toLowerCase() === "direct")
      .reduce((sum, row) => sum + toNumber(row.total_amount), 0);

    return [
      `Top customer by invoice value: ${toText(topCustomer?.customer)} (${formatNumber(toNumber(topCustomer?.total_amount))}).`,
      `Direct channel revenue in range: ${formatNumber(directRevenue)}.`,
    ];
  }, [config.key, distribution, rows]);

  return (
    <div className="space-y-4">
      <SummaryCards summary={summary} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="erp-card-static bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarDays className="size-4" />
              {config.key === "inventory" ? "Stock Movement Timeline" : "Revenue Timeline"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading timeline...</p>
            ) : isError ? (
              <p className="text-sm text-destructive">Unable to build timeline.</p>
            ) : (
              <MiniBars points={timeline} />
            )}
          </CardContent>
        </Card>

        <Card className="erp-card-static bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="size-4" />
              {config.key === "inventory"
                ? "Warehouse Distribution"
                : config.key === "purchase"
                  ? "Vendor Spend Distribution"
                  : "Channel Distribution"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading distribution...</p>
            ) : isError ? (
              <p className="text-sm text-destructive">Unable to build distribution.</p>
            ) : (
              <MiniBars points={distribution} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="erp-card-static bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Lightbulb className="size-4" />
            Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {highlights.map((line, index) => (
            <p key={`${config.key}-insight-${index}`}>{line}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportTabPanel({ config, active }: { config: ReportConfig; active: boolean }) {
  const state = useReportViewState(config, { enabled: active });

  return (
    <div className="space-y-4">
      <InsightsSection
        config={config}
        rows={state.rows}
        summary={state.reportQuery.data?.summary ?? {}}
        isLoading={state.reportQuery.isLoading}
        isError={state.reportQuery.isError}
      />
      <ReportView config={config} state={state} />
    </div>
  );
}

export function ReportsView() {
  const [activeTab, setActiveTab] = useState<(typeof REPORT_TABS)[number]["key"]>(
    "inventory",
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="erp-section-title mb-1">Business Intelligence</p>
          <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
        </div>
        <div className="hidden rounded-lg border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:flex sm:items-center sm:gap-2">
          <ChartColumnBig className="size-4" />
          Modular Reports Engine
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as (typeof REPORT_TABS)[number]["key"])
        }
        className="space-y-4"
      >
        <TabsList
          variant="line"
          className="w-full justify-start rounded-lg border bg-card p-1"
        >
          {REPORT_TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="gap-2 px-4">
              <tab.icon className="size-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="inventory">
          <ReportTabPanel config={REPORTS.inventory} active={activeTab === "inventory"} />
        </TabsContent>

        <TabsContent value="purchase">
          <ReportTabPanel config={REPORTS.purchase} active={activeTab === "purchase"} />
        </TabsContent>

        <TabsContent value="sales">
          <ReportTabPanel config={REPORTS.sales} active={activeTab === "sales"} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
