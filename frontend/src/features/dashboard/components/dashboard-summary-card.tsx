"use client";

import {
  ArrowRight,
  Truck,
  Users,
  ShoppingCart,
  Layers,
  AlertTriangle,
  Building2,
  ClipboardPlus,
  PackagePlus,
  TrendingUp,
  Package,
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

function StatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    FLAGGED: "bg-rose-500",
    COMPLETED: "bg-emerald-500",
    IN_PROGRESS: "bg-primary",
  };
  return (
    <span
      className={`inline-block size-1.5 rounded-full ${colorMap[status] || "bg-muted-foreground"}`}
    />
  );
}

/* ── Stat Card ──────────────────────────────────────────────────── */

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  href,
  alert,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string | number;
  href: string;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-all duration-200 group ${
        alert ? "border-rose-200 dark:border-rose-500/30" : "border-border"
      }`}
    >
      <div
        className={`flex size-10 items-center justify-center rounded-lg shrink-0 ${iconBg}`}
      >
        <Icon className={`size-[18px] ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p
          className={`text-xl font-semibold tabular-nums mt-0.5 ${
            alert ? "text-rose-600 dark:text-rose-400" : "text-foreground"
          }`}
        >
          {value}
        </p>
      </div>
    </Link>
  );
}

/* ── Main Component ─────────────────────────────────────────────── */

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
  const progressPct = Math.min(Math.round((finishedWeight / 20000) * 100), 100);

  return (
    <div className="space-y-6">
      {/* ── KPI Stat Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={Package}
          iconBg="bg-indigo-100 dark:bg-indigo-500/15"
          iconColor="text-indigo-600 dark:text-indigo-400"
          label="Total Stock"
          value={formatNumber(totalCoils)}
          href="/inventory"
        />
        <StatCard
          icon={TrendingUp}
          iconBg="bg-emerald-100 dark:bg-emerald-500/15"
          iconColor="text-emerald-600 dark:text-emerald-400"
          label="Finished"
          value={formatNumber(finishedWeight)}
          href="/inventory"
        />
        <StatCard
          icon={Users}
          iconBg="bg-violet-100 dark:bg-violet-500/15"
          iconColor="text-violet-600 dark:text-violet-400"
          label="Users"
          value={totalActiveUsers}
          href="/users"
        />
        <StatCard
          icon={ShoppingCart}
          iconBg="bg-amber-100 dark:bg-amber-500/15"
          iconColor="text-amber-600 dark:text-amber-400"
          label="Pending POs"
          value={pendingPOs}
          href="/procurement"
        />
        <StatCard
          icon={Layers}
          iconBg="bg-sky-100 dark:bg-sky-500/15"
          iconColor="text-sky-600 dark:text-sky-400"
          label="Total SKUs"
          value={totalItems}
          href="/inventory"
        />
        <StatCard
          icon={AlertTriangle}
          iconBg={
            lowStockCount > 0
              ? "bg-rose-100 dark:bg-rose-500/15"
              : "bg-muted"
          }
          iconColor={
            lowStockCount > 0
              ? "text-rose-600 dark:text-rose-400"
              : "text-muted-foreground"
          }
          label="Low Stock"
          value={lowStockCount}
          href="/inventory"
          alert={lowStockCount > 0}
        />
      </div>

      {/* ── Middle row: Progress + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Production progress card */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              Production Output
            </h3>
            <span className="text-xs text-muted-foreground">
              Target: 20,000
            </span>
          </div>

          <div className="flex items-end gap-6 mb-4">
            <div>
              <p className="text-3xl font-bold text-foreground tabular-nums">
                {formatNumber(finishedWeight)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Finished pipes weight
              </p>
            </div>
            <div className="pb-1">
              <p className="text-lg font-semibold text-muted-foreground tabular-nums">
                {formatNumber(rawWeight)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Raw material</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="h-2 bg-primary/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-indigo-400 rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{progressPct}% complete</span>
              <span>{formatNumber(20000 - finishedWeight)} remaining</span>
            </div>
          </div>
        </div>

        {/* Quick actions card */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Quick Actions
          </h3>
          <div className="space-y-1.5">
            <Link
              href="/procurement"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted transition-colors group"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-500/15">
                <Truck className="size-3.5 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground">
                  New Order
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Create purchase order
                </p>
              </div>
            </Link>
            <Link
              href="/inventory"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted transition-colors group"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-500/15">
                <PackagePlus className="size-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground">
                  Update Stock
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Inventory correction
                </p>
              </div>
            </Link>
            <Link
              href="/inventory?action=add"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted transition-colors group"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/15">
                <ClipboardPlus className="size-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground">
                  Add Item
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Register new SKU
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Activity Feed ── */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">
            Recent Activity
          </h3>
          <Link
            href="/logs"
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
          >
            View All
            <ArrowRight className="size-3" />
          </Link>
        </div>

        {recentActivity.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No recent activity.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentActivity.slice(0, 5).map((item, i) => (
              <div
                key={item.journal_id || i}
                className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
              >
                <StatusDot
                  status={item.scrap_qty > 0 ? "FLAGGED" : "COMPLETED"}
                />
                <span className="text-[13px] font-medium text-foreground truncate min-w-0 flex-1">
                  {item.source_batch || "Batch"}
                </span>
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {item.worker_name}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {item.input_qty} → {item.finished_qty}
                </span>
                {item.scrap_qty > 0 && (
                  <span className="text-[11px] text-rose-500 tabular-nums">
                    -{item.scrap_qty}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {timeAgo(item.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom links row ── */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/procurement/vendors"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-500/15">
            <Building2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground tabular-nums">
              {totalVendors}
            </p>
            <p className="text-[11px] text-muted-foreground">Active Vendors</p>
          </div>
        </Link>
        <Link
          href="/logs"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-500/15">
            <Building2 className="size-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground tabular-nums">
              {recentActivity.length}
            </p>
            <p className="text-[11px] text-muted-foreground">Recent Logs</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
