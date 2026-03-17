"use client";

import { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { Layers, Package, Tag, AlertTriangle, Search, Loader2 } from "lucide-react";

interface Category {
    id: string;
    name: string;
}

interface StockRow {
    product_id: string;
    product_name: string;
    product_sku: string;
    product_type: string | null;
    stock_status: string | null;
    tr_notes: string | null;
    uom: string;
    brand: string | null;
    category_id: string | null;
    total_stock: string;
}

export default function StockCoilPage() {
    const [rows, setRows] = useState<StockRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [categories, setCategories] = useState<Category[]>([]);
    const [categoryFilter, setCategoryFilter] = useState<string>("");

    useEffect(() => {
        api.get("/inventory/categories").then((r) => setCategories(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    }, []);

    useEffect(() => {
        fetchStock();
    }, [categoryFilter]);

    const fetchStock = async () => {
        try {
            setLoading(true);
            const url = categoryFilter ? `/reva/stock-levels?category_id=${categoryFilter}` : "/reva/stock-levels";
            const res = await api.get(url);
            setRows(res.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() => rows.filter(
        (r) =>
            r.product_name?.toLowerCase().includes(search.toLowerCase()) ||
            (r.product_type && r.product_type.toLowerCase().includes(search.toLowerCase())) ||
            r.product_sku?.toLowerCase().includes(search.toLowerCase()) ||
            (r.brand && r.brand.toLowerCase().includes(search.toLowerCase()))
    ), [rows, search]);

    const lowStock = filtered.filter((r) => {
        const n = parseFloat(r.total_stock);
        return n >= 0 && n < 500;
    });

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center bg-card/80 border border-border p-6 rounded-2xl shadow-xl">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center border border-violet-500/20">
                        <Layers className="w-6 h-6 text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
                            Stock Coil
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Inventory by item – type, # stock, status and notes (STOCK COIL view).
                        </p>
                    </div>
                </div>
            </div>

            {lowStock.length > 0 && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">
                        {lowStock.length} item(s) with stock &lt; 500 – consider reordering.
                    </span>
                </div>
            )}

            <div className="bg-card/60 border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-border flex flex-wrap gap-4 bg-card">
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by name, type, SKU or brand..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                    {categories.length > 0 && (
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground min-w-[180px] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        >
                            <option value="">All categories</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    )}
                    <div className="flex items-center text-xs text-muted-foreground">
                        {filtered.length} items
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/30 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Item name</th>
                                <th className="px-4 py-3">Brand</th>
                                <th className="px-4 py-3 flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Type</th>
                                <th className="px-4 py-3 text-right"># Stock</th>
                                <th className="px-4 py-3">UOM</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Tr notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-foreground">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                                            <span>Loading stock levels…</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                                        No products in this view. Add products, assign categories, or change the filter.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((r) => {
                                    const stockNum = parseFloat(r.total_stock);
                                    const isLow = stockNum >= 0 && stockNum < 500;
                                    return (
                                        <tr key={r.product_id} className="hover:bg-muted/50">
                                            <td className="px-4 py-3 font-medium text-foreground">
                                                {r.product_name}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">{r.brand || "—"}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{r.product_type || "—"}</td>
                                            <td className={`px-4 py-3 text-right font-mono ${isLow ? "text-amber-400" : "text-foreground"}`}>
                                                {r.total_stock}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">{r.uom || "KG"}</td>
                                            <td className="px-4 py-3">
                                                <span className={r.stock_status ? "text-emerald-400/90" : "text-muted-foreground"}>
                                                    {r.stock_status || "—"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground max-w-[120px] truncate" title={r.tr_notes || ""}>
                                                {r.tr_notes || "—"}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
