"use client";

import {
  useState,
  useMemo,
  useCallback,
  useActionState,
  useEffect,
} from "react";
import {
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
  PackageOpen,
  X,
} from "lucide-react";
import type {
  InventorySnapshot,
  InventoryViewRow,
  ItemDefinition,
  SelectableItem,
} from "@/features/inventory/types";
import { createItemFormAction } from "@/features/inventory/actions";
import { ReceiveStockForm } from "./receive-stock-form";
import { ItemDrillDown } from "./item-drill-down";

type InventoryTab = "raw" | "wip" | "finished";

type InventoryViewProps = {
  snapshot: InventorySnapshot;
  selectableItems: SelectableItem[];
  rawItems: ItemDefinition[];
  initialTab: InventoryTab;
  serviceAlert?: string;
};

const TAB_CONFIG: {
  key: InventoryTab;
  label: string;
  category: keyof InventorySnapshot;
}[] = [
  { key: "raw", label: "Raw Materials (Coils)", category: "RAW" },
  { key: "wip", label: "Finished Goods (Pipes)", category: "FINISHED" },
  { key: "finished", label: "Semi-Finished", category: "SEMI_FINISHED" },
];

const ITEMS_PER_PAGE = 8;

function StatusBadge({ qty }: { qty: number }) {
  if (qty <= 0)
    return <span className="erp-badge erp-badge--critical">Exhausted</span>;
  if (qty < 500)
    return <span className="erp-badge erp-badge--warning">Low Stock</span>;
  return <span className="erp-badge erp-badge--success">In Stock</span>;
}

function formatSpec(specs: Record<string, unknown>): string {
  const parts: string[] = [];
  if (specs.thickness) parts.push(`${specs.thickness}mm`);
  if (specs.width) parts.push(`${specs.width}mm`);
  if (specs.diameter) parts.push(`Ø${specs.diameter}mm`);
  return parts.join(" × ") || "—";
}

export function InventoryView({
  snapshot,
  selectableItems,
  rawItems,
  initialTab,
  serviceAlert,
}: InventoryViewProps) {
  const [activeTab, setActiveTab] = useState<InventoryTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddItem, setShowAddItem] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryViewRow | null>(
    null,
  );
  const [showReceiveStock, setShowReceiveStock] = useState(false);

  const tabConfig =
    TAB_CONFIG.find((t) => t.key === activeTab) ?? TAB_CONFIG[0];
  const rows = snapshot[tabConfig.category] || [];

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.sku && r.sku.toLowerCase().includes(q)) ||
        formatSpec(r.specs).toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / ITEMS_PER_PAGE),
  );
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const totalWeight = rows.reduce((sum, r) => sum + r.total_qty, 0);
  const activeSKUs = rows.length;

  const handleTabChange = useCallback((tab: InventoryTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchQuery("");
    setSelectedItem(null);
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="erp-section-title mb-1">Inventory Management</p>
          <h1 className="text-2xl font-bold text-[var(--erp-text-primary)]">
            Item Master
          </h1>
        </div>
        <button
          onClick={() => setShowAddItem(true)}
          className="flex items-center gap-2 rounded-lg bg-[var(--erp-accent)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] hover:bg-[var(--erp-accent-bright)] transition-colors shadow-lg shadow-cyan-500/15"
        >
          <Plus className="size-4" />
          Add New Item
        </button>
      </div>

      {serviceAlert && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
          <AlertTriangle className="size-4 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">{serviceAlert}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--erp-border-default)] overflow-x-auto">
        {TAB_CONFIG.map((tab) => {
          const count = (snapshot[tab.category] || []).length;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? "border-[var(--erp-accent)] text-[var(--erp-accent)]"
                  : "border-transparent text-[var(--erp-text-muted)] hover:text-[var(--erp-text-secondary)]"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  activeTab === tab.key
                    ? "bg-[var(--erp-accent-glow)] text-[var(--erp-accent)]"
                    : "bg-[var(--erp-bg-surface)] text-[var(--erp-text-muted)]"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-2 focus-within:border-[var(--erp-accent)] transition-colors">
          <Search className="size-4 text-[var(--erp-text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search Master Item ID, Spec or Serial..."
            className="flex-1 bg-transparent text-sm text-[var(--erp-text-primary)] placeholder:text-[var(--erp-text-muted)] outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-[var(--erp-text-muted)] hover:text-[var(--erp-text-primary)]"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <button className="flex items-center gap-1.5 rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-2 text-xs font-medium text-[var(--erp-text-secondary)] hover:border-[var(--erp-accent)] transition-colors">
          <Filter className="size-3.5" />
          Filters
        </button>
      </div>

      {/* Data Table */}
      <div className="erp-card-static overflow-hidden">
        <div className="overflow-x-auto">
          <table className="erp-table">
            <thead>
              <tr>
                <th style={{ width: "40px" }}>
                  <input
                    type="checkbox"
                    className="rounded border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)]"
                  />
                </th>
                <th>Material ID</th>
                <th>Description</th>
                <th>Specifications</th>
                <th className="text-right">Weight (MT)</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <PackageOpen className="size-10 text-[var(--erp-text-muted)] mx-auto mb-3 opacity-40" />
                    <p className="text-sm text-[var(--erp-text-muted)]">
                      {searchQuery
                        ? "No items match your search."
                        : "No items in this category yet."}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, i) => (
                  <tr
                    key={row.item_id}
                    style={{ animationDelay: `${i * 0.03}s` }}
                    className="erp-fade-in"
                  >
                    <td>
                      <input
                        type="checkbox"
                        className="rounded border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)]"
                      />
                    </td>
                    <td>
                      <button
                        onClick={() => setSelectedItem(row)}
                        className="text-[var(--erp-accent)] hover:text-[var(--erp-accent-bright)] font-mono text-xs font-medium transition-colors"
                      >
                        {row.sku || "SKU-PENDING"}
                      </button>
                    </td>
                    <td>
                      <p className="text-sm font-medium text-[var(--erp-text-primary)]">
                        {row.name}
                      </p>
                    </td>
                    <td>
                      <span className="font-mono text-xs text-[var(--erp-text-secondary)]">
                        {formatSpec(row.specs)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="font-mono font-semibold text-[var(--erp-text-primary)]">
                        {row.total_qty.toLocaleString("en-IN", {
                          maximumFractionDigits: 1,
                        })}
                      </span>
                    </td>
                    <td>
                      <StatusBadge qty={row.total_qty} />
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => setSelectedItem(row)}
                        className="text-[var(--erp-text-muted)] hover:text-[var(--erp-accent)] transition-colors"
                      >
                        <ArrowRight className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredRows.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--erp-border-subtle)]">
            <p className="text-xs text-[var(--erp-text-muted)]">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredRows.length)} of{" "}
              {filteredRows.length} items
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded text-[var(--erp-text-muted)] hover:text-[var(--erp-text-primary)] hover:bg-[var(--erp-bg-surface)] disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="size-4" />
              </button>
              {Array.from(
                { length: Math.min(totalPages, 5) },
                (_, i) => i + 1,
              ).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-[28px] h-7 rounded text-xs font-medium transition-colors ${
                    page === currentPage
                      ? "bg-[var(--erp-accent)] text-[var(--primary-foreground)]"
                      : "text-[var(--erp-text-muted)] hover:text-[var(--erp-text-primary)] hover:bg-[var(--erp-bg-surface)]"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="p-1.5 rounded text-[var(--erp-text-muted)] hover:text-[var(--erp-text-primary)] hover:bg-[var(--erp-bg-surface)] disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section: Analytics + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Inventory Health Analytics */}
        <div className="lg:col-span-2 erp-card-static p-5">
          <p className="erp-kpi-label mb-1">Inventory Health Analytics</p>
          <p className="text-sm text-[var(--erp-text-muted)] mb-5">
            Real-time tonnage distribution across grade categories.
          </p>
          <div className="flex items-end gap-2 h-28">
            {[65, 45, 80, 30, 55, 70, 40].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full erp-bar" style={{ height: `${h}%` }} />
                <span className="text-[9px] text-[var(--erp-text-muted)]">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="erp-card-static p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <p className="erp-kpi-label">Total Weight</p>
              <p className="text-2xl font-bold text-[var(--erp-text-primary)] tabular-nums">
                {totalWeight.toLocaleString("en-IN", {
                  maximumFractionDigits: 1,
                })}
                <span className="text-sm font-normal text-[var(--erp-text-muted)] ml-1">
                  MT
                </span>
              </p>
            </div>
            <div>
              <p className="erp-kpi-label">Active SKUs</p>
              <p className="text-2xl font-bold text-[var(--erp-text-primary)] tabular-nums">
                {activeSKUs}
              </p>
            </div>
          </div>
          <button className="flex items-center gap-2 justify-center mt-4 w-full rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] py-2 text-xs font-semibold text-[var(--erp-accent)] hover:border-[var(--erp-accent)] transition-colors">
            View Detailed Report
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>

      {/* ── Receive Stock Slideout ── */}
      {showReceiveStock && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowReceiveStock(false)}
          />
          <div className="relative w-full max-w-md bg-[var(--card)] border-l border-[var(--erp-border-default)] overflow-y-auto erp-slide-in">
            <div className="flex items-center justify-between p-5 border-b border-[var(--erp-border-subtle)]">
              <h2 className="text-lg font-semibold text-[var(--erp-text-primary)]">
                Receive Stock
              </h2>
              <button
                onClick={() => setShowReceiveStock(false)}
                className="p-1 text-[var(--erp-text-muted)] hover:text-[var(--erp-text-primary)]"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="p-5">
              <ReceiveStockForm />
            </div>
          </div>
        </div>
      )}

      {/* ── Item Drill Down Dialog ── */}
      <ItemDrillDown
        item={
          selectedItem
            ? {
                id: selectedItem.item_id,
                name: selectedItem.name,
                category:
                  tabConfig.category === "RAW"
                    ? "RAW"
                    : tabConfig.category === "FINISHED"
                      ? "FINISHED"
                      : "SEMI_FINISHED",
                base_unit: "WEIGHT",
                specs: {
                  thickness: Number(selectedItem.specs?.thickness) || 0,
                  width: Number(selectedItem.specs?.width) || 0,
                  coil_weight: Number(selectedItem.specs?.coil_weight) || 0,
                },
                is_active: true,
              }
            : null
        }
        open={!!selectedItem}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
      />

      {/* ── Add Item Slideout ── */}
      {showAddItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAddItem(false)}
          />
          <div className="relative w-full max-w-md bg-[var(--card)] border-l border-[var(--erp-border-default)] overflow-y-auto erp-slide-in">
            <div className="flex items-center justify-between p-5 border-b border-[var(--erp-border-subtle)]">
              <h2 className="text-lg font-semibold text-[var(--erp-text-primary)]">
                Add New Item
              </h2>
              <button
                onClick={() => setShowAddItem(false)}
                className="p-1 text-[var(--erp-text-muted)] hover:text-[var(--erp-text-primary)]"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="p-5">
              <AddItemForm onClose={() => setShowAddItem(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Inline Add Item Form ── */
function AddItemForm({ onClose }: { onClose: () => void }) {
  const [itemType, setItemType] = useState<"COIL" | "PIPE">("COIL");
  const [state, formAction, isPending] = useActionState(createItemFormAction, {
    ok: false,
    message: "",
  });

  useEffect(() => {
    if (!state.ok) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onClose();
      window.location.reload();
    }, 800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [state.ok, onClose]);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="item_type" value={itemType} />

      {/* Item type toggle */}
      <div>
        <p className="erp-kpi-label mb-2">Item Classification</p>
        <div className="grid grid-cols-2 gap-2">
          {(["COIL", "PIPE"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setItemType(type)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                itemType === type
                  ? "bg-[var(--erp-accent)] text-[var(--primary-foreground)]"
                  : "bg-[var(--erp-bg-surface)] text-[var(--erp-text-muted)] border border-[var(--erp-border-default)] hover:border-[var(--erp-accent)]"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Form fields */}
      <div className="space-y-3">
        <div>
          <label className="erp-kpi-label mb-1 block">Material Name</label>
          <input
            name="name"
            required
            placeholder="e.g. Hot Rolled Carbon Steel Coil"
            className="w-full rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-2.5 text-sm text-[var(--erp-text-primary)] placeholder:text-[var(--erp-text-muted)] outline-none focus:border-[var(--erp-accent)] transition-colors"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="erp-kpi-label mb-1 block">Thickness (mm)</label>
            <input
              name="thickness"
              type="number"
              step="0.01"
              placeholder="4.50"
              className="w-full rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-2.5 text-sm text-[var(--erp-text-primary)] placeholder:text-[var(--erp-text-muted)] outline-none focus:border-[var(--erp-accent)] transition-colors"
            />
          </div>
          <div>
            <label className="erp-kpi-label mb-1 block">Width (mm)</label>
            <input
              name="width"
              type="number"
              step="0.01"
              placeholder="1250.0"
              className="w-full rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-2.5 text-sm text-[var(--erp-text-primary)] placeholder:text-[var(--erp-text-muted)] outline-none focus:border-[var(--erp-accent)] transition-colors"
            />
          </div>
        </div>
        <div>
          <label className="erp-kpi-label mb-1 block">
            Initial Weight (MT)
          </label>
          <input
            name="coil_weight"
            type="number"
            step="0.01"
            placeholder="18.420"
            className="w-full rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-2.5 text-sm text-[var(--erp-text-primary)] placeholder:text-[var(--erp-text-muted)] outline-none focus:border-[var(--erp-accent)] transition-colors"
          />
        </div>
      </div>

      {state.message && (
        <p
          className={`text-sm rounded-lg px-3 py-2 ${state.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-red-500/10 text-red-400 border border-red-500/30"}`}
        >
          {state.message}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-lg border border-[var(--erp-border-default)] py-2.5 text-sm font-medium text-[var(--erp-text-secondary)] hover:bg-[var(--erp-bg-surface)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-lg bg-[var(--erp-accent)] py-2.5 text-sm font-semibold text-[var(--primary-foreground)] hover:bg-[var(--erp-accent-bright)] disabled:opacity-50 transition-colors"
        >
          {isPending ? "Creating..." : "Create Item"}
        </button>
      </div>
    </form>
  );
}
