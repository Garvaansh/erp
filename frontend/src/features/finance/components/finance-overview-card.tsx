"use client";

import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Zap,
  Factory,
  Users,
  DollarSign,
  Download,
} from "lucide-react";

// Mock finance data — ready for backend API integration
const MOCK_FINANCE = {
  totalRevenue: 4829102,
  operationalCosts: 1240500,
  accountsReceivable: 842000,
  accountsPayable: 312400,
  energyCost: 412800,
  materialCost: 528400,
  laborCost: 199300,
  cashFlowMonths: [
    { month: "MAY", realized: 45, projected: 55 },
    { month: "JUN", realized: 55, projected: 65 },
    { month: "JUL", realized: 70, projected: 60 },
    { month: "AUG", realized: 60, projected: 75 },
    { month: "SEP (EST)", realized: 50, projected: 80 },
  ],
  transactions: [
    { entity: "Iron Ore Logistics Group", desc: "Bulk Material Acquisition", txId: "TP-E2R3X-TX", category: "MATERIALS", amount: -142500, status: "SETTLED" },
    { entity: "Titanium Aerospace Ltd.", desc: "Service Contract Payment", txId: "TP-S4012-TX", category: "SALES", amount: 289000, status: "SETTLED" },
    { entity: "Grid-Systems", desc: "Annual Utility Renewal", txId: "TP-R6318-TX", category: "ENERGY", amount: -74300, status: "PENDING" },
  ],
};

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}K`;
  return `$${abs.toLocaleString()}`;
}

function formatFullCurrency(value: number): string {
  return "$" + Math.abs(value).toLocaleString("en-US");
}

export function FinanceOverviewCard() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="erp-section-title mb-1">
            Fiscal Quarter Q3 • Precision Performance Tracking
          </p>
          <h1 className="text-2xl font-bold text-[var(--erp-text-primary)]">
            Finance Overview
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--erp-text-secondary)] hover:border-[var(--erp-accent)] transition-colors">
            <Download className="size-3.5" />
            Download Report
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-[var(--erp-accent)] px-4 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] hover:bg-[var(--erp-accent-bright)] transition-colors">
            Execute Transaction
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Revenue" value={formatFullCurrency(MOCK_FINANCE.totalRevenue)} change="+12.8% vs LY" positive icon={<DollarSign className="size-4" />} />
        <KPICard label="Operational Costs" value={formatFullCurrency(MOCK_FINANCE.operationalCosts)} change="+3.1% Budget Alert" positive={false} icon={<Factory className="size-4" />} />
        <KPICard label="Accounts Receivable" value={formatFullCurrency(MOCK_FINANCE.accountsReceivable)} change="84% Collected" positive icon={<TrendingUp className="size-4" />} />
        <KPICard label="Accounts Payable" value={formatFullCurrency(MOCK_FINANCE.accountsPayable)} change="Due in 18 Days" positive={false} icon={<TrendingDown className="size-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Cash Flow Chart */}
        <div className="lg:col-span-2 erp-card-static p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm font-semibold text-[var(--erp-text-primary)]">
                Cash Flow Analysis (Real vs Projected)
              </p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-[var(--erp-accent)]" />
                  <span className="text-[10px] text-[var(--erp-text-muted)]">Realized</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-[var(--erp-bg-surface)] border border-[var(--erp-border-default)]" />
                  <span className="text-[10px] text-[var(--erp-text-muted)]">Projected</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-end gap-3 h-36">
            {MOCK_FINANCE.cashFlowMonths.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end" style={{ height: "100%" }}>
                  <div className="flex-1 erp-bar" style={{ height: `${m.realized}%` }} />
                  <div className="flex-1 erp-bar--muted rounded-t" style={{ height: `${m.projected}%` }} />
                </div>
                <span className="text-[9px] text-[var(--erp-text-muted)] mt-1">{m.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="space-y-4">
          <CostCard label="Energy Expenditure" value={formatFullCurrency(MOCK_FINANCE.energyCost)} change="Efficiency: +4% Improved" icon={<Zap className="size-4 text-[var(--erp-warning)]" />} />
          <CostCard label="Material Sourcing" value={formatFullCurrency(MOCK_FINANCE.materialCost)} change="Volatility Index: High" icon={<Factory className="size-4 text-[var(--erp-accent)]" />} />
          <CostCard label="Direct Labor" value={formatFullCurrency(MOCK_FINANCE.laborCost)} change="Overtime: Optimized" icon={<Users className="size-4 text-[var(--erp-info)]" />} />
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="erp-card-static overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--erp-border-subtle)]">
          <p className="text-sm font-semibold text-[var(--erp-text-primary)]">Recent High-Value Transactions</p>
          <button className="text-[10px] font-semibold text-[var(--erp-accent)] hover:text-[var(--erp-accent-bright)] uppercase tracking-wider transition-colors flex items-center gap-1">
            View Ledger
            <ArrowRight className="size-3" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Entity / Counterparty</th>
                <th>Transaction ID</th>
                <th>Category</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_FINANCE.transactions.map((tx, i) => (
                <tr key={i} className="erp-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  <td>
                    <p className="text-sm font-medium text-[var(--erp-text-primary)]">{tx.entity}</p>
                    <p className="text-[10px] text-[var(--erp-text-muted)]">{tx.desc}</p>
                  </td>
                  <td className="font-mono text-xs text-[var(--erp-text-muted)]">{tx.txId}</td>
                  <td>
                    <span className={`erp-badge ${
                      tx.category === "MATERIALS" ? "erp-badge--warning" :
                      tx.category === "SALES" ? "erp-badge--success" :
                      "erp-badge--info"
                    }`}>
                      {tx.category}
                    </span>
                  </td>
                  <td className={`text-right font-mono text-sm font-semibold ${
                    tx.amount >= 0 ? "text-[var(--erp-success)]" : "text-[var(--erp-text-primary)]"
                  }`}>
                    {tx.amount >= 0 ? "+" : "-"}{formatFullCurrency(tx.amount)}
                  </td>
                  <td>
                    <span className={`erp-badge ${tx.status === "SETTLED" ? "erp-badge--success" : "erp-badge--warning"}`}>
                      {tx.status}
                    </span>
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

/* ── Sub-components ── */

function KPICard({ label, value, change, positive, icon }: {
  label: string; value: string; change: string; positive: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="erp-card-static p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-[var(--erp-accent)]">{icon}</div>
        <span className="erp-kpi-label">{label}</span>
      </div>
      <p className="text-xl font-bold text-[var(--erp-text-primary)] tabular-nums mb-1">{value}</p>
      <p className={`text-[10px] font-medium ${positive ? "text-[var(--erp-success)]" : "text-[var(--erp-warning)]"}`}>
        {positive ? "▲" : "●"} {change}
      </p>
    </div>
  );
}

function CostCard({ label, value, change, icon }: {
  label: string; value: string; change: string; icon: React.ReactNode;
}) {
  return (
    <div className="erp-card-static p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--erp-accent-glow)]">
          {icon}
        </div>
        <div>
          <p className="erp-kpi-label">{label}</p>
          <p className="text-lg font-bold text-[var(--erp-text-primary)] tabular-nums">{value}</p>
          <p className="text-[10px] text-[var(--erp-text-muted)]">{change}</p>
        </div>
      </div>
    </div>
  );
}
