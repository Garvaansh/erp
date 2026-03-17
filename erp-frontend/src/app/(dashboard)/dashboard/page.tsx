"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Package, Activity, Inbox, RefreshCw, BarChart2, ShoppingCart, Users, Clock, TrendingUp } from "lucide-react";
import { useMockData } from "@/app/(dashboard)/layout";

function parseNum(v: unknown): number {
    if (v == null) return 0;
    if (typeof v === "number") return v;
    if (typeof v === "string") return parseFloat(v) || 0;
    return 0;
}

interface DashboardMetrics {
    daily_sales?: { sale_date?: string; total_revenue?: string }[];
    production_output?: { production_date?: string; total_produced?: string }[];
    inventory_valuation?: unknown;
    procurement_spend_30d?: unknown;
    vendor_count?: number;
    purchase_order_count_30d?: number;
    stock_aging_over_90d?: unknown;
}

export default function DashboardPage() {
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const { mockData } = useMockData();

    useEffect(() => {
        fetchMetrics();
    }, [mockData]);

    const fetchMetrics = async () => {
        try {
            setLoading(true);
            const res = await api.get("/reports/dashboard");
            setMetrics(res.data ?? null);
        } catch (err) {
            console.error(err);
            setMetrics(null);
        } finally {
            setLoading(false);
        }
    };

    const totalSalesThisWeek = metrics?.daily_sales?.slice(0, 7).reduce((acc, sale) => acc + parseNum(sale?.total_revenue), 0) ?? 0;
    const recentProduction = metrics?.production_output?.slice(0, 7).reduce((acc, p) => acc + parseNum(p?.total_produced), 0) ?? 0;
    const valAmt = parseNum(metrics?.inventory_valuation).toLocaleString("en-IN", { style: "currency", currency: "INR" });
    const procurementSpend = parseNum(metrics?.procurement_spend_30d).toLocaleString("en-IN", { style: "currency", currency: "INR" });
    const vendorCount = metrics?.vendor_count ?? 0;
    const poCount30d = metrics?.purchase_order_count_30d ?? 0;
    const stockAging90d = parseNum(metrics?.stock_aging_over_90d).toLocaleString("en-IN", { style: "currency", currency: "INR" });

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Header section */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Executive Dashboard</h1>
                    <p className="text-muted-foreground">Welcome back. Here is your overview for today.</p>
                </div>
                <button
                    onClick={fetchMetrics}
                    disabled={loading}
                    className="bg-muted border border-border hover:bg-muted text-foreground text-sm py-2 px-4 rounded-xl flex items-center gap-2 transition-all shadow-sm disabled:opacity-70"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
                    Refresh
                </button>
            </div>

            {loading && !metrics && (
                <div className="bg-card/80 border border-border rounded-2xl p-8 text-center text-muted-foreground">
                    Loading dashboard…
                </div>
            )}

            {/* KPI Cards - All six dashboard metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* 1. Inventory valuation */}
                <div className="bg-card/80 border border-border p-6 rounded-2xl shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-orange-500/20 transition-all" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center border border-orange-500/20">
                            <Package className="w-5 h-5 text-orange-400" />
                        </div>
                    </div>
                    <h3 className="text-muted-foreground text-sm font-medium mb-1 tracking-wide">Inventory valuation</h3>
                    <p className="text-2xl font-semibold text-foreground tracking-tight">{valAmt}</p>
                </div>

                {/* 2. Procurement spend */}
                <div className="bg-card/80 border border-border p-6 rounded-2xl shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-blue-500/20 transition-all" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                            <ShoppingCart className="w-5 h-5 text-blue-400" />
                        </div>
                    </div>
                    <h3 className="text-muted-foreground text-sm font-medium mb-1 tracking-wide">Procurement spend (30d)</h3>
                    <p className="text-2xl font-semibold text-foreground tracking-tight">{procurementSpend}</p>
                </div>

                {/* 3. Vendor performance */}
                <div className="bg-card/80 border border-border p-6 rounded-2xl shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-violet-500/20 transition-all" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center border border-violet-500/20">
                            <Users className="w-5 h-5 text-violet-400" />
                        </div>
                    </div>
                    <h3 className="text-muted-foreground text-sm font-medium mb-1 tracking-wide">Vendor performance</h3>
                    <p className="text-2xl font-semibold text-foreground tracking-tight">{vendorCount} vendors</p>
                    <p className="text-xs text-muted-foreground mt-1">{poCount30d} POs (30d)</p>
                </div>

                {/* 4. Stock aging */}
                <div className="bg-card/80 border border-border p-6 rounded-2xl shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-amber-500/20 transition-all" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
                            <Clock className="w-5 h-5 text-amber-400" />
                        </div>
                    </div>
                    <h3 className="text-muted-foreground text-sm font-medium mb-1 tracking-wide">Stock aging (&gt;90d)</h3>
                    <p className="text-2xl font-semibold text-foreground tracking-tight">{stockAging90d}</p>
                    <p className="text-xs text-muted-foreground mt-1">Value of batched stock older than 90 days</p>
                </div>

                {/* 5. Manufacturing efficiency */}
                <div className="bg-card/80 border border-border p-6 rounded-2xl shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-emerald-500/20 transition-all" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                            <Activity className="w-5 h-5 text-emerald-400" />
                        </div>
                    </div>
                    <h3 className="text-muted-foreground text-sm font-medium mb-1 tracking-wide">Manufacturing output (7d)</h3>
                    <p className="text-2xl font-semibold text-foreground tracking-tight">{recentProduction.toLocaleString()} units</p>
                </div>

                {/* 6. Revenue analysis */}
                <div className="bg-card/80 border border-border p-6 rounded-2xl shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-indigo-500/20 transition-all" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                            <TrendingUp className="w-5 h-5 text-indigo-400" />
                        </div>
                    </div>
                    <h3 className="text-muted-foreground text-sm font-medium mb-1 tracking-wide">Revenue (7d)</h3>
                    <p className="text-2xl font-semibold text-foreground tracking-tight">₹{totalSalesThisWeek.toLocaleString("en-IN")}</p>
                </div>

            </div>

            {/* Main Graph Area - Revenue Trajectory from API data */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">

                <div className="lg:col-span-2 bg-card/80 border border-border rounded-2xl p-6 shadow-xl h-96 flex flex-col relative overflow-hidden">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-foreground font-medium flex items-center gap-2"><BarChart2 className="w-5 h-5 text-primary" /> Revenue Trajectory</h3>
                        <div className="text-xs text-muted-foreground">Last 30 Days</div>
                    </div>

                    <div className="flex-1 flex items-end gap-1 pb-4 opacity-90 px-2 min-h-0">
                        {(() => {
                            const sales = metrics?.daily_sales?.slice(0, 30) ?? [];
                            const maxRev = Math.max(1, ...sales.map((s) => parseNum(s?.total_revenue)));
                            const bars = sales.length > 0
                                ? sales.map((s) => (parseNum(s?.total_revenue) / maxRev) * 100)
                                : [40, 60, 45, 80, 50, 65, 90, 75, 55, 100, 85, 70, 60, 95];
                            return bars.map((h, i) => (
                                <div key={i} className="flex-1 min-w-0 rounded-t-sm bg-gradient-to-t from-indigo-500/20 to-indigo-500/60 hover:to-indigo-400 transition-colors cursor-pointer group relative" style={{ height: `${Math.max(4, h)}%` }}>
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] text-foreground bg-black/80 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-border z-10">
                                        {sales[i] ? `₹${parseNum(sales[i]?.total_revenue).toLocaleString("en-IN")}` : `${h.toFixed(0)}%`}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>

                    <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-card to-transparent pointer-events-none"></div>
                </div>

                <div className="bg-card/80 border border-border rounded-2xl p-6 shadow-xl h-96">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-foreground font-medium flex items-center gap-2"><Inbox className="w-5 h-5 text-emerald-400" /> Recent Activity</h3>
                    </div>

                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((item) => (
                            <div key={item} className="flex gap-4 p-3 rounded-xl hover:bg-muted transition-colors cursor-pointer">
                                <div className="w-2 h-2 mt-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                                <div>
                                    <p className="text-sm text-foreground">Work Order <span className="text-foreground font-medium">#WO-00{item}</span> completed.</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">2 hours ago</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
}
