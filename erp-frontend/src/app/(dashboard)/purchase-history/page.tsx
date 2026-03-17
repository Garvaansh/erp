"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { FileText, Truck, Package, Calendar, Search } from "lucide-react";

interface PurchaseHistoryRow {
    po_id: string;
    po_number: string;
    order_date: string;
    vendor_id: string;
    vendor_name: string;
    vendor_status_notes: string | null;
    product_id: string;
    product_name: string;
    product_sku: string;
    product_type: string | null;
    uom: string;
    quantity: string;
    unit_price: string;
    total_price: string;
}

export default function PurchaseHistoryPage() {
    const [rows, setRows] = useState<PurchaseHistoryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const res = await api.get("/reva/purchase-history?limit=500");
            setRows(res.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const filtered = rows.filter(
        (r) =>
            r.vendor_name?.toLowerCase().includes(search.toLowerCase()) ||
            r.product_name?.toLowerCase().includes(search.toLowerCase()) ||
            r.po_number?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center bg-card/80 border border-border p-6 rounded-2xl shadow-xl">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                        <FileText className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
                            Purchase History
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Reva item purchase history – orders, vendors and line items.
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-card/60 border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-border flex gap-4 bg-card">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by vendor, product or PO number..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground">
                        {filtered.length} of {rows.length} lines
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/30 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Date</th>
                                <th className="px-4 py-3">PO</th>
                                <th className="px-4 py-3 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Vendor</th>
                                <th className="px-4 py-3">Vendor notes</th>
                                <th className="px-4 py-3 flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Item</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3 text-right">Qty</th>
                                <th className="px-4 py-3 text-right">Unit price</th>
                                <th className="px-4 py-3 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-foreground">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                                        Loading...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                                        No purchase history. Create purchase orders and add items.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((r, idx) => (
                                    <tr key={`${r.po_id}-${r.product_id}-${idx}`} className="hover:bg-muted/50">
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {r.order_date
                                                ? new Date(r.order_date).toLocaleDateString("en-IN", {
                                                      day: "2-digit",
                                                      month: "2-digit",
                                                      year: "numeric",
                                                  })
                                                : "—"}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-foreground">{r.po_number}</td>
                                        <td className="px-4 py-3 text-foreground">{r.vendor_name}</td>
                                        <td className="px-4 py-3 max-w-[120px] truncate text-amber-400/90" title={r.vendor_status_notes || ""}>
                                            {r.vendor_status_notes || "—"}
                                        </td>
                                        <td className="px-4 py-3 text-foreground">{r.product_name}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{r.product_type || "—"}</td>
                                        <td className="px-4 py-3 text-right">{r.quantity} {r.uom}</td>
                                        <td className="px-4 py-3 text-right">{r.unit_price}</td>
                                        <td className="px-4 py-3 text-right font-medium">{r.total_price}</td>
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
