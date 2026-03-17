"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import Link from "next/link";
import { ArrowLeft, Factory, Wrench, Plus } from "lucide-react";

interface ProductionOrder {
    id: string;
    po_number: string;
    product_id: string;
    quantity: string;
    start_date: string | null;
    end_date: string | null;
    production_line_id: string | null;
    status: string;
}
interface WorkOrder {
    id: string;
    wo_number: string;
    product_id: string;
    status: string;
    planned_quantity: string;
    produced_quantity: string;
    operation_type: string | null;
    sequence: number;
}
interface Product {
    id: string;
    name: string;
}
interface ProductionLine {
    id: string;
    name: string;
}

export default function ProductionOrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const [po, setPo] = useState<ProductionOrder | null>(null);
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [lines, setLines] = useState<ProductionLine[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!id) return;
        fetchAll();
    }, [id]);

    const fetchAll = async () => {
        try {
            setLoading(true);
            const [poRes, productsRes, linesRes] = await Promise.all([
                api.get(`/manufacturing/production-orders/${id}`),
                api.get("/inventory/products"),
                api.get("/manufacturing/production-lines").catch(() => ({ data: [] })),
            ]);
            setPo(poRes.data);
            setProducts(productsRes.data || []);
            setLines(linesRes.data || []);
            try {
                const woRes = await api.get(`/manufacturing/production-orders/${id}/work-orders`);
                setWorkOrders(Array.isArray(woRes.data) ? woRes.data : []);
            } catch {
                setWorkOrders([]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const createWorkOrders = async () => {
        try {
            setCreating(true);
            await api.post(`/manufacturing/production-orders/${id}/create-work-orders`);
            fetchAll();
        } catch (err) {
            console.error(err);
            alert("Failed to create work orders");
        } finally {
            setCreating(false);
        }
    };

    const getProductName = (pid: string) => products.find((p) => p.id === pid)?.name ?? "—";
    const getLineName = (lid: string | null) => (lid ? lines.find((l) => l.id === lid)?.name : "—") ?? "—";

    if (!po && !loading) {
        return (
            <div className="p-6">
                <p className="text-muted-foreground">Production order not found.</p>
                <Link href="/production-orders" className="text-amber-400 hover:text-amber-300 mt-2 inline-block">← Back to list</Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-4">
                <button onClick={() => router.push("/production-orders")} className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
                    <Factory className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{po?.po_number ?? "—"}</h1>
                    <p className="text-sm text-muted-foreground">
                        {getProductName(po?.product_id ?? "")} · Qty {po?.quantity ?? "—"} · {getLineName(po?.production_line_id ?? null)}
                    </p>
                </div>
            </div>

            <div className="bg-card/80 border border-border rounded-2xl p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-foreground mb-4">Work Orders</h2>
                <p className="text-sm text-muted-foreground mb-4">
                    Each production order can have multiple work order steps: Cutting → Welding → Polishing → Inspection.
                </p>
                {workOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-xl bg-muted/20">
                        <p className="text-muted-foreground mb-4">No work orders yet. Create them from this production order.</p>
                        <button
                            onClick={createWorkOrders}
                            disabled={creating}
                            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-70 text-white text-sm font-medium py-2.5 px-5 rounded-xl flex items-center gap-2"
                        >
                            {creating ? <span className="animate-spin">⏳</span> : <Plus className="w-4 h-4" />}
                            Create Work Orders (Cutting, Welding, Polishing, Inspection)
                        </button>
                    </div>
                ) : (
                    <>
                        <ul className="space-y-2">
                            {workOrders
                                .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
                                .map((wo) => (
                                    <li key={wo.id} className="flex items-center justify-between py-2 px-4 bg-muted/30 rounded-xl border border-border">
                                        <div className="flex items-center gap-3">
                                            <Wrench className="w-4 h-4 text-amber-400" />
                                            <span className="font-mono text-sm">{wo.wo_number}</span>
                                            {wo.operation_type && (
                                                <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted">{wo.operation_type}</span>
                                            )}
                                            <span className="text-muted-foreground text-sm">
                                                {wo.planned_quantity} / {wo.produced_quantity ?? "0"} · {wo.status}
                                            </span>
                                        </div>
                                        <Link href={`/work-orders/${wo.id}`} className="text-amber-400 hover:text-amber-300 text-sm font-medium">
                                            View
                                        </Link>
                                    </li>
                                ))}
                        </ul>
                    </>
                )}
            </div>
        </div>
    );
}
