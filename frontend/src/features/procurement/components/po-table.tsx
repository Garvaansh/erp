"use client";

import Link from "next/link";
import type { ProcurementOrderListItem } from "@/features/procurement/types";
import { ArrowRight, PackageOpen } from "lucide-react";

type POTableProps = {
  orders: ProcurementOrderListItem[];
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "erp-badge--warning",
    DELIVERED: "erp-badge--success",
    CANCELLED: "erp-badge--critical",
  };
  return (
    <span className={`erp-badge ${map[status] || "erp-badge--neutral"}`}>
      {status}
    </span>
  );
}

export function POTable({ orders }: POTableProps) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <PackageOpen className="size-10 text-[var(--erp-text-muted)] mb-3 opacity-40" />
        <p className="text-sm text-[var(--erp-text-muted)]">No procurement orders yet.</p>
        <Link
          href="/procurement/create"
          className="mt-4 text-xs font-semibold text-[var(--erp-accent)] hover:text-[var(--erp-accent-bright)] uppercase tracking-wider transition-colors"
        >
          Create your first order →
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="erp-table">
        <thead>
          <tr>
            <th>PO Number</th>
            <th>Supplier</th>
            <th>Item</th>
            <th className="text-right">Ordered</th>
            <th className="text-right">Received</th>
            <th className="text-right">Unit Price</th>
            <th>Status</th>
            <th className="text-right">Created</th>
            <th style={{ width: "40px" }} />
          </tr>
        </thead>
        <tbody>
          {orders.map((order, i) => (
            <tr key={order.id} className="erp-fade-in" style={{ animationDelay: `${i * 0.03}s` }}>
              <td>
                <Link
                  href={`/procurement/${order.id}`}
                  className="text-[var(--erp-accent)] hover:text-[var(--erp-accent-bright)] font-mono text-xs font-semibold transition-colors"
                >
                  {order.po_number}
                </Link>
              </td>
              <td>
                <span className="text-sm text-[var(--erp-text-primary)]">{order.supplier_name}</span>
              </td>
              <td>
                <span className="text-sm text-[var(--erp-text-secondary)]">
                  {order.item_name || "—"}
                </span>
                {order.item_sku && (
                  <span className="block text-[10px] font-mono text-[var(--erp-text-muted)]">{order.item_sku}</span>
                )}
              </td>
              <td className="text-right font-mono text-sm text-[var(--erp-text-primary)]">
                {order.ordered_qty.toLocaleString()}
              </td>
              <td className="text-right font-mono text-sm text-[var(--erp-text-primary)]">
                {order.received_qty.toLocaleString()}
              </td>
              <td className="text-right font-mono text-sm text-[var(--erp-text-secondary)]">
                ₹{order.unit_price.toLocaleString()}
              </td>
              <td>
                <StatusBadge status={order.status} />
              </td>
              <td className="text-right text-xs text-[var(--erp-text-muted)]">
                {order.created_at
                  ? new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                  : "—"}
              </td>
              <td>
                <Link
                  href={`/procurement/${order.id}`}
                  className="text-[var(--erp-text-muted)] hover:text-[var(--erp-accent)] transition-colors"
                >
                  <ArrowRight className="size-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
