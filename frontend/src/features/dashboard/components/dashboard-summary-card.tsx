"use client";

import {
  PackageSearch,
  ArrowUpRight,
  ArrowRight,
  ClipboardPlus,
  PackagePlus,
  Truck,
  Activity,
  Users,
  HeartPulse,
  ShoppingCart,
  Layers,
  AlertTriangle,
  Building2,
} from "lucide-react";
import type { DashboardSummary } from "@/features/dashboard/types";
import Link from "next/link";

type DashboardSummaryCardProps = {
  summary: DashboardSummary;
};

function formatNumber(value: number): string {
  return value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DELIVERED: "erp-badge--success",
    PROCESSING: "erp-badge--warning",
    FLAGGED: "erp-badge--critical",
    IN_PROGRESS: "erp-badge--info",
    COMPLETED: "erp-badge--success",
    ACTIVE: "erp-badge--accent",
  };
  return (
    <span className={`erp-badge ${map[status] || "erp-badge--neutral"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function DashboardSummaryCard({ summary }: DashboardSummaryCardProps) {
  const rawWeight = summary.total_raw_material_weight ?? 0;
  const finishedWeight = summary.total_finished_pipes_weight ?? 0;
  const totalCoils = rawWeight + finishedWeight;
  const recentActivity = summary.recent_activity ?? [];
  const pendingPOs = summary.pending_po_count ?? 0;
  const totalActiveUsers = summary.total_active_users ?? 0;
  const totalItems = summary.total_items_sku ?? 0;
  const lowStockCount = summary.low_stock_count ?? 0;
  const totalVendors = summary.total_vendors ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="erp-section-title mb-1">Live Production Analytics</p>
          <h1 className="text-2xl font-bold text-[var(--erp-text-primary)]">
            Main Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="erp-badge--neutral erp-badge">
            Last 24 Hours
          </button>
          <button className="flex items-center gap-1.5 rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--erp-text-secondary)] hover:border-[var(--erp-accent)] transition-colors">
            Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left Column: KPIs ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Total Coils KPI + Breakdown */}
          <div className="erp-card-static p-5">
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <PackageSearch className="size-4 text-[var(--erp-accent)]" />
                  <span className="erp-kpi-label">Total Coils in Stock</span>
                </div>
                <div className="flex items-end gap-3">
                  <span className="erp-kpi-value">
                    {formatNumber(totalCoils)}
                  </span>
                  {totalCoils > 0 && (
                    <span className="flex items-center gap-1 text-xs text-[var(--erp-success)] font-medium mb-1">
                      <ArrowUpRight className="size-3" />
                      Active
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-[var(--erp-border-subtle)]">
                  <div>
                    <p className="erp-kpi-label mb-1">Grade A Raw Material</p>
                    <p className="text-xl font-bold text-[var(--erp-text-primary)] tabular-nums">
                      {formatNumber(rawWeight)}
                    </p>
                  </div>
                  <div>
                    <p className="erp-kpi-label mb-1">Cold Rolled</p>
                    <p className="text-xl font-bold text-[var(--erp-text-primary)] tabular-nums">
                      {formatNumber(finishedWeight)}
                    </p>
                  </div>
                </div>
              </div>
              <Link
                href="/inventory"
                className="flex items-center gap-2 text-xs font-semibold text-[var(--erp-accent)] hover:text-[var(--erp-accent-bright)] transition-colors whitespace-nowrap"
              >
                Detailed Inventory
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>

          {/* Production Output + Activity Feed */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Production */}
            <div className="erp-card-static p-5">
              <p className="erp-kpi-label mb-2">Total Pipes Manufactured</p>
              <p className="text-3xl font-bold text-[var(--erp-text-primary)] tabular-nums mb-3">
                {formatNumber(finishedWeight)}
              </p>
              <div className="flex items-center gap-3 text-xs text-[var(--erp-text-muted)] mb-3">
                <span>Current monthly output</span>
                <span className="font-semibold text-[var(--erp-text-secondary)]">
                  Target: 20,000
                </span>
              </div>
              <div className="erp-progress mb-2">
                <div
                  className="erp-progress-fill"
                  style={{
                    width: `${Math.min((finishedWeight / 20000) * 100, 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[var(--erp-text-muted)]">
                <span>
                  {Math.round((finishedWeight / 20000) * 100)}% Complete
                </span>
                <span>{formatNumber(20000 - finishedWeight)} remaining</span>
              </div>
            </div>

            {/* Activity Feed */}
            <div className="erp-card-static p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="erp-kpi-label">Recent Activity Feed</p>
                <Link
                  href="/logs"
                  className="text-[10px] font-semibold text-[var(--erp-accent)] hover:text-[var(--erp-accent-bright)] uppercase tracking-wider"
                >
                  View All
                </Link>
              </div>
              <div className="space-y-3">
                {recentActivity.length === 0 ? (
                  <p className="text-xs text-[var(--erp-text-muted)]">
                    No recent activity.
                  </p>
                ) : (
                  recentActivity.slice(0, 4).map((item, i) => (
                    <div
                      key={item.journal_id || i}
                      className="flex items-start gap-3 group"
                    >
                      <div className="mt-0.5">
                        <Activity className="size-3.5 text-[var(--erp-accent)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[var(--erp-text-primary)] truncate">
                            {item.source_batch || "Batch"}
                          </span>
                          <StatusBadge
                            status={
                              item.scrap_qty > 0 ? "FLAGGED" : "COMPLETED"
                            }
                          />
                        </div>
                        <p className="text-[10px] text-[var(--erp-text-muted)] mt-0.5">
                          {item.worker_name} • In: {item.input_qty} → Out:{" "}
                          {item.finished_qty}
                          {item.scrap_qty > 0
                            ? ` • Scrap: ${item.scrap_qty}`
                            : ""}
                        </p>
                      </div>
                      <span className="text-[10px] text-[var(--erp-text-muted)] whitespace-nowrap">
                        {timeAgo(item.created_at)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column: Quick Ops ── */}
        <div className="space-y-5">
          <div className="erp-card-static p-5">
            <p className="erp-kpi-label mb-4">Quick Operations</p>
            <div className="space-y-2">
              <Link
                href="/procurement"
                className="flex items-center gap-3 rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] p-3 hover:border-[var(--erp-accent)] hover:bg-[var(--erp-accent-glow)] transition-all group"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--erp-accent-glow)] text-[var(--erp-accent)] group-hover:bg-[var(--erp-accent-glow-strong)]">
                  <Truck className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--erp-text-primary)]">
                    New Order
                  </p>
                  <p className="text-[10px] text-[var(--erp-text-muted)]">
                    Dispatch items to client
                  </p>
                </div>
              </Link>
              <Link
                href="/inventory"
                className="flex items-center gap-3 rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] p-3 hover:border-[var(--erp-accent)] hover:bg-[var(--erp-accent-glow)] transition-all group"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--erp-accent-glow)] text-[var(--erp-accent)] group-hover:bg-[var(--erp-accent-glow-strong)]">
                  <PackagePlus className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--erp-text-primary)]">
                    Update Stock
                  </p>
                  <p className="text-[10px] text-[var(--erp-text-muted)]">
                    Manual inventory correction
                  </p>
                </div>
              </Link>
              <Link
                href="/inventory?action=add"
                className="flex items-center gap-3 rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] p-3 hover:border-[var(--erp-accent)] hover:bg-[var(--erp-accent-glow)] transition-all group"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--erp-accent-glow)] text-[var(--erp-accent)] group-hover:bg-[var(--erp-accent-glow-strong)]">
                  <ClipboardPlus className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--erp-text-primary)]">
                    Add Item
                  </p>
                  <p className="text-[10px] text-[var(--erp-text-muted)]">
                    Register new SKU
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic System KPIs Footer */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="erp-card-static p-4 flex items-center gap-4">
          <HeartPulse className="size-5 text-[var(--erp-success)]" />
          <div>
            <p className="erp-kpi-label">System Health</p>
            <p className="text-xl font-bold text-[var(--erp-text-primary)] tabular-nums">
              99.98%
            </p>
          </div>
        </div>
        <Link
          href="/users"
          className="erp-card-static p-4 flex items-center gap-4 hover:border-[var(--erp-accent)] transition-colors"
        >
          <Users className="size-5 text-[var(--erp-accent)]" />
          <div>
            <p className="erp-kpi-label">Active Users</p>
            <p className="text-xl font-bold text-[var(--erp-text-primary)] tabular-nums">
              {totalActiveUsers}
            </p>
          </div>
        </Link>
        <Link
          href="/procurement"
          className="erp-card-static p-4 flex items-center gap-4 hover:border-[var(--erp-accent)] transition-colors"
        >
          <ShoppingCart className="size-5 text-amber-400" />
          <div>
            <p className="erp-kpi-label">Pending Orders</p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold text-[var(--erp-text-primary)] tabular-nums">
                {pendingPOs}
              </p>
              {pendingPOs > 0 && (
                <span className="text-[10px] text-amber-400 font-semibold animate-pulse">
                  • Action Required
                </span>
              )}
            </div>
          </div>
        </Link>
        <Link
          href="/inventory"
          className="erp-card-static p-4 flex items-center gap-4 hover:border-[var(--erp-accent)] transition-colors"
        >
          <Layers className="size-5 text-purple-400" />
          <div>
            <p className="erp-kpi-label">Registered SKUs</p>
            <p className="text-xl font-bold text-[var(--erp-text-primary)] tabular-nums">
              {totalItems}
            </p>
          </div>
        </Link>
        <Link
          href="/inventory"
          className={`erp-card-static p-4 flex items-center gap-4 hover:border-[var(--erp-accent)] transition-colors ${lowStockCount > 0 ? "border-red-500/40 bg-red-500/5" : ""}`}
        >
          <AlertTriangle
            className={`size-5 ${lowStockCount > 0 ? "text-red-400 animate-pulse" : "text-[var(--erp-text-muted)]"}`}
          />
          <div>
            <p className="erp-kpi-label">Low Stock Alerts</p>
            <div className="flex items-center gap-2">
              <p
                className={`text-xl font-bold tabular-nums ${lowStockCount > 0 ? "text-red-400" : "text-[var(--erp-text-primary)]"}`}
              >
                {lowStockCount}
              </p>
              {lowStockCount > 0 && (
                <span className="text-[10px] text-red-400 font-semibold animate-pulse">
                  • Critical
                </span>
              )}
            </div>
          </div>
        </Link>
        <Link
          href="/procurement/vendors"
          className="erp-card-static p-4 flex items-center gap-4 hover:border-[var(--erp-accent)] transition-colors"
        >
          <Building2 className="size-5 text-teal-400" />
          <div>
            <p className="erp-kpi-label">Total Vendors</p>
            <p className="text-xl font-bold text-[var(--erp-text-primary)] tabular-nums">
              {totalVendors}
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
