"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PackageSearch,
  Truck,
  Users,
  Download,
  Loader2,
  BarChart3,
  AlertTriangle,
  TrendingUp,
  Clock,
  Check,
  Ban,
  Shield,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  getInventoryReport,
  getPurchaseReport,
  getUsersReport,
} from "@/features/reports/api";
import type {
  ReportTab,
  InventoryReport,
  PurchaseReport,
  UsersReport,
} from "@/features/reports/types";
import { reportsKeys } from "@/lib/react-query/keys";

/* ── Utility ── */
function formatNumber(v: number): string {
  return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
function formatCurrency(v: number): string {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/* ── CSV Export ── */
function downloadCSV(headers: string[], rows: string[][], filename: string) {
  const csv = [
    headers.join(","),
    ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Bar Chart (CSS only) ── */
function BarChart({
  data,
  labelKey,
  valueKey,
  color = "var(--erp-accent)",
}: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  color?: string;
}) {
  const values = data.map((d) => Number(d[valueKey]) || 0);
  const max = Math.max(...values, 1);

  if (data.length === 0)
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[var(--erp-text-muted)]">
        No data for selected period
      </div>
    );

  return (
    <div className="flex items-end gap-1 h-40 px-2">
      {data.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const pct = (val / max) * 100;
        const label = String(d[labelKey]);
        return (
          <div
            key={i}
            className="flex-1 flex flex-col items-center gap-1 min-w-0 group"
          >
            <div className="relative w-full flex justify-center">
              <div
                className="w-full max-w-[28px] rounded-t-md transition-all duration-500 ease-out group-hover:opacity-80"
                style={{
                  height: `${Math.max(pct, 3)}%`,
                  background: color,
                  minHeight: "4px",
                  animationDelay: `${i * 50}ms`,
                }}
              />
              <div className="absolute -top-6 bg-[var(--sidebar)] border border-[var(--erp-border-subtle)] rounded px-1.5 py-0.5 text-[9px] text-[var(--erp-text-primary)] font-mono opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                {formatNumber(val)}
              </div>
            </div>
            <span className="text-[8px] text-[var(--erp-text-muted)] truncate w-full text-center">
              {label.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── KPI Card ── */
function KPICard({
  icon: Icon,
  label,
  value,
  subtext,
  color = "text-[var(--erp-accent)]",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
}) {
  return (
    <div className="erp-card-static p-4 flex items-center gap-4">
      <Icon className={`size-5 shrink-0 ${color}`} />
      <div className="min-w-0">
        <p className="erp-kpi-label">{label}</p>
        <p className="text-xl font-bold text-[var(--erp-text-primary)] tabular-nums">
          {value}
        </p>
        {subtext && (
          <p className="text-[10px] text-[var(--erp-text-muted)]">{subtext}</p>
        )}
      </div>
    </div>
  );
}

/* ── Inventory Tab ── */
function InventoryTab({ data }: { data: InventoryReport }) {
  return (
    <div className="space-y-6 erp-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KPICard
          icon={PackageSearch}
          label="Total SKUs"
          value={data.total_items}
        />
        <KPICard
          icon={BarChart3}
          label="Total Stock"
          value={formatNumber(data.total_stock_qty)}
          subtext="kg on hand"
          color="text-emerald-400"
        />
        <KPICard
          icon={AlertTriangle}
          label="Low Stock Items"
          value={data.low_stock_count}
          color={
            data.low_stock_count > 0
              ? "text-red-400"
              : "text-[var(--erp-text-muted)]"
          }
        />
        <KPICard
          icon={TrendingUp}
          label="Active Batches"
          value={data.stock_on_hand.reduce((s, r) => s + r.batch_count, 0)}
          color="text-purple-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="erp-card-static p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="erp-kpi-label">Stock Movement (Daily)</p>
          </div>
          <BarChart
            data={data.movement_by_day}
            labelKey="date"
            valueKey="total_qty"
            color="var(--erp-accent)"
          />
        </div>

        <div className="erp-card-static p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="erp-kpi-label">Category Distribution</p>
          </div>
          {(() => {
            const cats: Record<string, number> = {};
            data.stock_on_hand.forEach((r) => {
              cats[r.category] = (cats[r.category] || 0) + r.total_qty;
            });
            const entries = Object.entries(cats).sort((a, b) => b[1] - a[1]);
            const max = Math.max(...entries.map((e) => e[1]), 1);
            return entries.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-[var(--erp-text-muted)]">
                No inventory data
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map(([cat, qty]) => (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[var(--erp-text-secondary)] capitalize">
                        {cat.toLowerCase().replace(/_/g, " ")}
                      </span>
                      <span className="text-xs font-mono text-[var(--erp-text-primary)]">
                        {formatNumber(qty)} kg
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--erp-bg-surface)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--erp-accent)] to-cyan-500 transition-all duration-700"
                        style={{ width: `${(qty / max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      <div className="erp-card-static overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[var(--erp-border-subtle)]">
          <p className="erp-kpi-label">Stock On Hand Detail</p>
          <button
            type="button"
            onClick={() =>
              downloadCSV(
                [
                  "SKU",
                  "Name",
                  "Category",
                  "Total Qty",
                  "Available",
                  "Min",
                  "Max",
                  "Low Stock",
                  "Batches",
                ],
                data.stock_on_hand.map((r) => [
                  r.sku,
                  r.name,
                  r.category,
                  String(r.total_qty),
                  String(r.available_qty),
                  String(r.min_qty),
                  String(r.max_qty),
                  r.is_low_stock ? "YES" : "NO",
                  String(r.batch_count),
                ]),
                "inventory_report.csv",
              )
            }
            className="flex items-center gap-1.5 rounded-md bg-[var(--erp-bg-surface)] border border-[var(--erp-border-default)] px-3 py-1.5 text-[10px] font-semibold text-[var(--erp-text-secondary)] hover:border-[var(--erp-accent)] hover:text-[var(--erp-accent)] transition-colors"
          >
            <Download className="size-3" /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="erp-table w-full">
            <thead>
              <tr>
                <th className="erp-table-th text-left">Item</th>
                <th className="erp-table-th text-left">Category</th>
                <th className="erp-table-th text-right">Stock</th>
                <th className="erp-table-th text-right">Available</th>
                <th className="erp-table-th text-right">Min / Max</th>
                <th className="erp-table-th text-right">Batches</th>
                <th className="erp-table-th text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.stock_on_hand.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="erp-table-td text-center text-[var(--erp-text-muted)] py-8"
                  >
                    No inventory items found
                  </td>
                </tr>
              ) : (
                data.stock_on_hand.map((r, i) => (
                  <tr
                    key={r.item_id}
                    className="erp-table-row erp-fade-in"
                    style={{ animationDelay: `${i * 20}ms` }}
                  >
                    <td className="erp-table-td">
                      <p className="text-sm font-medium text-[var(--erp-text-primary)]">
                        {r.name}
                      </p>
                      <p className="text-[10px] text-[var(--erp-text-muted)] font-mono">
                        {r.sku || "—"}
                      </p>
                    </td>
                    <td className="erp-table-td">
                      <span className="text-xs text-[var(--erp-text-secondary)] capitalize">
                        {r.category.toLowerCase().replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="erp-table-td text-right font-mono text-sm">
                      {formatNumber(r.total_qty)}
                    </td>
                    <td className="erp-table-td text-right font-mono text-sm">
                      {formatNumber(r.available_qty)}
                    </td>
                    <td className="erp-table-td text-right font-mono text-xs text-[var(--erp-text-muted)]">
                      {r.min_qty} / {r.max_qty}
                    </td>
                    <td className="erp-table-td text-right font-mono text-sm">
                      {r.batch_count}
                    </td>
                    <td className="erp-table-td">
                      {r.is_low_stock ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400 ring-1 ring-red-500/30">
                          <AlertTriangle className="size-3" /> Low
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
                          <Check className="size-3" /> OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Purchase Tab ── */
function PurchaseTab({ data }: { data: PurchaseReport }) {
  return (
    <div className="space-y-6 erp-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KPICard icon={Truck} label="Total Orders" value={data.total_orders} />
        <KPICard
          icon={Clock}
          label="Pending"
          value={data.total_pending}
          color={
            data.total_pending > 0
              ? "text-amber-400"
              : "text-[var(--erp-text-muted)]"
          }
        />
        <KPICard
          icon={TrendingUp}
          label="Total Value"
          value={formatCurrency(data.total_value)}
          color="text-emerald-400"
        />
        <KPICard
          icon={BarChart3}
          label="Vendors Active"
          value={data.by_vendor.length}
          color="text-teal-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="erp-card-static p-5">
          <p className="erp-kpi-label mb-4">Order Timeline</p>
          <BarChart
            data={data.timeline}
            labelKey="date"
            valueKey="total_value"
            color="#10b981"
          />
        </div>

        <div className="erp-card-static p-5">
          <p className="erp-kpi-label mb-4">Vendor Spend Distribution</p>
          {data.by_vendor.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-[var(--erp-text-muted)]">
              No purchase data
            </div>
          ) : (
            <div className="space-y-3">
              {data.by_vendor.slice(0, 8).map((v) => {
                const max = data.by_vendor[0]?.total_value || 1;
                return (
                  <div key={v.vendor_name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[var(--erp-text-secondary)]">
                        {v.vendor_name}
                      </span>
                      <span className="text-xs font-mono text-[var(--erp-text-primary)]">
                        {formatCurrency(v.total_value)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--erp-bg-surface)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
                        style={{ width: `${(v.total_value / max) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="erp-card-static overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[var(--erp-border-subtle)]">
          <p className="erp-kpi-label">Purchase Summary by Vendor</p>
          <button
            type="button"
            onClick={() =>
              downloadCSV(
                [
                  "Vendor",
                  "Total Orders",
                  "Pending",
                  "Delivered",
                  "Total Value",
                  "Total Qty",
                ],
                data.by_vendor.map((r) => [
                  r.vendor_name,
                  String(r.total_orders),
                  String(r.pending_pos),
                  String(r.delivered_pos),
                  String(r.total_value),
                  String(r.total_qty),
                ]),
                "purchase_report.csv",
              )
            }
            className="flex items-center gap-1.5 rounded-md bg-[var(--erp-bg-surface)] border border-[var(--erp-border-default)] px-3 py-1.5 text-[10px] font-semibold text-[var(--erp-text-secondary)] hover:border-[var(--erp-accent)] hover:text-[var(--erp-accent)] transition-colors"
          >
            <Download className="size-3" /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="erp-table w-full">
            <thead>
              <tr>
                <th className="erp-table-th text-left">Vendor</th>
                <th className="erp-table-th text-right">Orders</th>
                <th className="erp-table-th text-right">Pending</th>
                <th className="erp-table-th text-right">Delivered</th>
                <th className="erp-table-th text-right">Total Value</th>
                <th className="erp-table-th text-right">Total Qty</th>
              </tr>
            </thead>
            <tbody>
              {data.by_vendor.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="erp-table-td text-center text-[var(--erp-text-muted)] py-8"
                  >
                    No purchase orders in period
                  </td>
                </tr>
              ) : (
                data.by_vendor.map((r, i) => (
                  <tr
                    key={r.vendor_name}
                    className="erp-table-row erp-fade-in"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <td className="erp-table-td">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-bold text-white shrink-0">
                          {r.vendor_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-[var(--erp-text-primary)]">
                          {r.vendor_name}
                        </span>
                      </div>
                    </td>
                    <td className="erp-table-td text-right font-mono text-sm">
                      {r.total_orders}
                    </td>
                    <td className="erp-table-td text-right">
                      {r.pending_pos > 0 ? (
                        <span className="text-sm font-mono text-amber-400">
                          {r.pending_pos}
                        </span>
                      ) : (
                        <span className="text-sm font-mono text-[var(--erp-text-muted)]">
                          0
                        </span>
                      )}
                    </td>
                    <td className="erp-table-td text-right font-mono text-sm text-emerald-400">
                      {r.delivered_pos}
                    </td>
                    <td className="erp-table-td text-right font-mono text-sm font-semibold">
                      {formatCurrency(r.total_value)}
                    </td>
                    <td className="erp-table-td text-right font-mono text-sm">
                      {formatNumber(r.total_qty)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Users Tab ── */
function UsersTab({ data }: { data: UsersReport }) {
  return (
    <div className="space-y-6 erp-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KPICard icon={Users} label="Total Users" value={data.total_users} />
        <KPICard
          icon={Check}
          label="Active"
          value={data.active_users}
          color="text-emerald-400"
        />
        <KPICard
          icon={Shield}
          label="Admins"
          value={data.admin_count}
          color="text-purple-400"
        />
        <KPICard
          icon={Users}
          label="Workers"
          value={data.worker_count}
          color="text-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="erp-card-static p-5">
          <p className="erp-kpi-label mb-4">Role Distribution</p>
          {(() => {
            const roles: Record<string, number> = {};
            data.users.forEach((u) => {
              roles[u.role] = (roles[u.role] || 0) + 1;
            });
            const entries = Object.entries(roles).sort((a, b) => b[1] - a[1]);
            const total = data.total_users || 1;
            const colors: Record<string, string> = {
              SUPER_ADMIN: "from-purple-500 to-pink-500",
              ADMIN: "from-blue-500 to-cyan-500",
              WORKER: "from-amber-500 to-orange-500",
            };
            return (
              <div className="space-y-4">
                {entries.map(([role, count]) => (
                  <div key={role}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-[var(--erp-text-secondary)] uppercase tracking-wider">
                        {role.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs font-mono text-[var(--erp-text-primary)]">
                        {count} ({Math.round((count / total) * 100)}%)
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-[var(--erp-bg-surface)] overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${colors[role] || "from-gray-500 to-gray-400"} transition-all duration-700`}
                        style={{ width: `${(count / total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        <div className="erp-card-static p-5">
          <p className="erp-kpi-label mb-4">Status Overview</p>
          <div className="flex items-center justify-center gap-8 py-8">
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center">
                <svg className="size-24 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    fill="none"
                    stroke="var(--erp-bg-surface)"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3"
                    strokeDasharray={`${(data.active_users / (data.total_users || 1)) * 100} ${100 - (data.active_users / (data.total_users || 1)) * 100}`}
                  />
                </svg>
                <span className="absolute text-lg font-bold text-[var(--erp-text-primary)]">
                  {Math.round(
                    (data.active_users / (data.total_users || 1)) * 100,
                  )}
                  %
                </span>
              </div>
              <p className="text-xs text-[var(--erp-text-muted)] mt-2">
                Active Rate
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="erp-card-static overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[var(--erp-border-subtle)]">
          <p className="erp-kpi-label">All Users</p>
          <button
            type="button"
            onClick={() =>
              downloadCSV(
                ["Name", "Email", "Role", "Active", "Created"],
                data.users.map((u) => [
                  u.name,
                  u.email,
                  u.role,
                  u.is_active ? "Yes" : "No",
                  u.created_at.slice(0, 10),
                ]),
                "users_report.csv",
              )
            }
            className="flex items-center gap-1.5 rounded-md bg-[var(--erp-bg-surface)] border border-[var(--erp-border-default)] px-3 py-1.5 text-[10px] font-semibold text-[var(--erp-text-secondary)] hover:border-[var(--erp-accent)] hover:text-[var(--erp-accent)] transition-colors"
          >
            <Download className="size-3" /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="erp-table w-full">
            <thead>
              <tr>
                <th className="erp-table-th text-left">User</th>
                <th className="erp-table-th text-left">Role</th>
                <th className="erp-table-th text-left">Status</th>
                <th className="erp-table-th text-left">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u, i) => (
                <tr
                  key={u.user_id}
                  className="erp-table-row erp-fade-in"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <td className="erp-table-td">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--erp-accent)] to-teal-600 text-[10px] font-bold text-white shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--erp-text-primary)]">
                          {u.name}
                        </p>
                        <p className="text-[10px] text-[var(--erp-text-muted)]">
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="erp-table-td">
                    <span
                      className={`erp-badge ${u.role === "SUPER_ADMIN" ? "erp-badge--critical" : u.role === "ADMIN" ? "erp-badge--info" : "erp-badge--neutral"}`}
                    >
                      {u.role.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="erp-table-td">
                    {u.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
                        <Check className="size-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400 ring-1 ring-red-500/30">
                        <Ban className="size-3" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="erp-table-td text-xs text-[var(--erp-text-muted)]">
                    {u.created_at.slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Main Reports View ── */
const TABS: {
  key: ReportTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "inventory", label: "Inventory", icon: PackageSearch },
  { key: "purchase", label: "Purchase", icon: Truck },
  { key: "users", label: "Users", icon: Users },
];

const PERIOD_OPTIONS = [
  { value: 7, label: "Last 7 Days" },
  { value: 14, label: "Last 14 Days" },
  { value: 30, label: "Last 30 Days" },
  { value: 60, label: "Last 60 Days" },
  { value: 90, label: "Last 90 Days" },
];

export function ReportsView() {
  const [tab, setTab] = useState<ReportTab>("inventory");
  const [days, setDays] = useState(30);

  const inventoryQuery = useQuery({
    queryKey: reportsKeys.inventory(days),
    queryFn: () => getInventoryReport(days),
    enabled: tab === "inventory",
    refetchOnWindowFocus: false,
  });

  const purchaseQuery = useQuery({
    queryKey: reportsKeys.purchase(days),
    queryFn: () => getPurchaseReport(days),
    enabled: tab === "purchase",
    refetchOnWindowFocus: false,
  });

  const usersQuery = useQuery({
    queryKey: reportsKeys.users(),
    queryFn: () => getUsersReport(),
    enabled: tab === "users",
    refetchOnWindowFocus: false,
  });

  const isLoading =
    (tab === "inventory" && inventoryQuery.isLoading) ||
    (tab === "purchase" && purchaseQuery.isLoading) ||
    (tab === "users" && usersQuery.isLoading);

  const isError =
    (tab === "inventory" && inventoryQuery.isError) ||
    (tab === "purchase" && purchaseQuery.isError) ||
    (tab === "users" && usersQuery.isError);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="erp-section-title mb-1">Business Intelligence</p>
          <h1 className="text-2xl font-bold text-[var(--erp-text-primary)]">
            Reports & Analytics
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="appearance-none rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-2 pr-8 text-xs font-semibold text-[var(--erp-text-primary)] outline-none focus:border-[var(--erp-accent)] transition-colors cursor-pointer"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-[var(--erp-text-muted)] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-[var(--erp-bg-surface)] p-1 border border-[var(--erp-border-subtle)]">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-[var(--erp-accent)] to-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                  : "text-[var(--erp-text-muted)] hover:text-[var(--erp-text-primary)] hover:bg-[var(--erp-bg-surface)]"
              }`}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-8 text-[var(--erp-accent)] animate-spin" />
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-24 text-sm text-red-400">
          Failed to load report data. Please try again.
        </div>
      ) : (
        <>
          {tab === "inventory" && inventoryQuery.data && (
            <InventoryTab data={inventoryQuery.data} />
          )}
          {tab === "purchase" && purchaseQuery.data && (
            <PurchaseTab data={purchaseQuery.data} />
          )}
          {tab === "users" && usersQuery.data && (
            <UsersTab data={usersQuery.data} />
          )}
        </>
      )}
    </div>
  );
}
