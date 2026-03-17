"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ClipboardList, Package } from "lucide-react";

interface MRPRequirement {
    product_id: string;
    required_quantity: number;
    production_order_numbers: string[];
}

export default function MRPReportPage() {
    const [loading, setLoading] = useState(true);
    const [count, setCount] = useState(0);
    const [requirements, setRequirements] = useState<MRPRequirement[]>([]);
    const [products, setProducts] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchReport();
        api.get("/inventory/products").then((r) => {
            const list = Array.isArray(r.data) ? r.data : [];
            const map: Record<string, string> = {};
            list.forEach((p: { id: string; name: string }) => { map[p.id] = p.name; });
            setProducts(map);
        }).catch(() => {});
    }, []);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const res = await api.get("/manufacturing/mrp/report");
            setCount(res.data?.production_orders_count ?? 0);
            setRequirements(res.data?.material_requirements ?? []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center bg-card/80 border border-border p-6 rounded-2xl shadow-xl">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
                        <ClipboardList className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">MRP Report</h1>
                        <p className="text-sm text-muted-foreground">Material requirements from open production orders (BOM explosion).</p>
                    </div>
                </div>
            </div>

            <div className="bg-card/60 backdrop-blur-md border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-border bg-muted/30">
                    <p className="text-sm text-muted-foreground">
                        Production orders considered: <span className="font-medium text-foreground">{count}</span> (excluding Completed/Cancelled).
                    </p>
                </div>
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="px-6 py-12 text-center text-muted-foreground">Loading MRP report...</div>
                    ) : requirements.length === 0 ? (
                        <div className="px-6 py-12 text-center text-muted-foreground">
                            No material requirements. Create production orders with BOMs to see requirements here.
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-muted/30 text-muted-foreground font-medium">
                                <tr>
                                    <th className="px-6 py-4">Component Product</th>
                                    <th className="px-6 py-4">Required Quantity</th>
                                    <th className="px-6 py-4">Production Orders</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-foreground">
                                {requirements.map((r) => (
                                    <tr key={r.product_id} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-6 py-4 flex items-center gap-2">
                                            <Package className="w-4 h-4 text-muted-foreground" />
                                            {products[r.product_id] ?? r.product_id}
                                        </td>
                                        <td className="px-6 py-4 font-mono">{Number(r.required_quantity).toLocaleString()}</td>
                                        <td className="px-6 py-4 text-muted-foreground">{r.production_order_numbers?.join(", ") ?? "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
