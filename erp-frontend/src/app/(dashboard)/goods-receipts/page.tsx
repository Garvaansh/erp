"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Package, Loader2 } from "lucide-react";

interface GoodsReceipt {
    id: string;
    po_id: string;
    warehouse_id: string;
    receipt_number: string;
    receipt_date: string;
    notes?: string | null;
    created_at: string;
}

export default function GoodsReceiptsPage() {
    const [list, setList] = useState<GoodsReceipt[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const res = await api.get("/purchase/goods-receipts");
                setList(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error(err);
                setList([]);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                        <Package className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Goods Receipts</h1>
                        <p className="text-sm text-muted-foreground">GRNs linked to purchase orders; stock is updated on receipt.</p>
                    </div>
                </div>
            </div>

            <div className="bg-card/80 border border-border rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                    </div>
                ) : list.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm">No goods receipts yet. Create one from a purchase order.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-left text-muted-foreground">
                                    <th className="px-6 py-4 font-medium">Receipt #</th>
                                    <th className="px-6 py-4 font-medium">PO ID</th>
                                    <th className="px-6 py-4 font-medium">Receipt date</th>
                                    <th className="px-6 py-4 font-medium">Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map((gr) => (
                                    <tr key={gr.id} className="border-b border-border hover:bg-muted/50">
                                        <td className="px-6 py-4 text-foreground font-mono">{gr.receipt_number}</td>
                                        <td className="px-6 py-4 text-foreground font-mono truncate max-w-[180px]">{gr.po_id}</td>
                                        <td className="px-6 py-4 text-foreground">{gr.receipt_date || "—"}</td>
                                        <td className="px-6 py-4 text-muted-foreground">{gr.created_at ? new Date(gr.created_at).toLocaleString() : "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
