"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Plus, Search, Wrench, MoreVertical, FileText } from "lucide-react";
import Link from "next/link";

interface Product {
    id: string;
    name: string;
    sku?: string;
}

interface Bom {
    id: string;
    product_id: string;
    name: string;
    version: string;
}

interface WorkOrder {
    id: string;
    wo_number: string;
    product_id: string;
    bom_id: string | null;
    sales_order_id: string | null;
    status: string;
    planned_quantity: string;
    produced_quantity: string;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
    operation_type?: string | null;
    production_order_id?: string | null;
}

export default function WorkOrdersPage() {
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [boms, setBoms] = useState<Bom[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [newWO, setNewWO] = useState({
        wo_number: "",
        product_id: "",
        bom_id: "",
        sales_order_id: "",
        planned_quantity: "",
        start_date: "",
        end_date: "",
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [woRes, productRes, bomRes] = await Promise.all([
                api.get("/manufacturing/work-orders"),
                api.get("/inventory/products"),
                api.get("/manufacturing/bom").catch(() => ({ data: [] })),
            ]);
            setWorkOrders(woRes.data || []);
            setProducts(productRes.data || []);
            setBoms(bomRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const createWO = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: Record<string, string> = {
                wo_number: newWO.wo_number,
                product_id: newWO.product_id,
                planned_quantity: newWO.planned_quantity,
            };
            if (newWO.start_date) payload.start_date = newWO.start_date;
            if (newWO.end_date) payload.end_date = newWO.end_date;
            if (newWO.bom_id) payload.bom_id = newWO.bom_id;
            if (newWO.sales_order_id) payload.sales_order_id = newWO.sales_order_id;
            await api.post("/manufacturing/work-orders", payload);
            setShowModal(false);
            setNewWO({
                wo_number: "",
                product_id: "",
                bom_id: "",
                sales_order_id: "",
                planned_quantity: "",
                start_date: "",
                end_date: "",
            });
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Failed to create Work Order");
        }
    };

    const getProductName = (id: string) => {
        const p = products.find((x) => x.id === id);
        return p ? p.name : "—";
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "PLANNED":
                return "bg-zinc-500/10 text-muted-foreground border-zinc-500/20";
            case "IN_PROGRESS":
                return "bg-amber-500/10 text-amber-400 border-amber-500/20";
            case "COMPLETED":
                return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            case "CANCELLED":
                return "bg-red-500/10 text-red-400 border-red-500/20";
            default:
                return "bg-zinc-500/10 text-muted-foreground border-zinc-500/20";
        }
    };

    const filtered = workOrders.filter(
        (wo) =>
            wo.wo_number.toLowerCase().includes(search.toLowerCase()) ||
            getProductName(wo.product_id).toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center bg-card/80 border border-border p-6 rounded-2xl shadow-xl">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
                        <Wrench className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Work Orders</h1>
                        <p className="text-sm text-muted-foreground">Manufacturing work orders, production logs, and material consumption.</p>
                    </div>
                </div>

                <button
                    onClick={() => setShowModal(true)}
                    className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                >
                    <Plus className="w-4 h-4" />
                    Create Work Order
                </button>
            </div>

            <div className="bg-card/60 backdrop-blur-md border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-border flex gap-4 bg-card">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by WO number or product..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all text-sm text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-muted/30 text-muted-foreground font-medium">
                            <tr>
                                <th className="px-6 py-4">WO Number</th>
                                <th className="px-6 py-4">Product</th>
                                <th className="px-6 py-4">Operation</th>
                                <th className="px-6 py-4">Planned / Produced</th>
                                <th className="px-6 py-4">Start / End</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-foreground">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                                        Loading work orders...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                        No work orders found. Create one to get started.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((wo) => (
                                    <tr key={wo.id} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-foreground flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-muted-foreground" />
                                            {wo.wo_number}
                                        </td>
                                        <td className="px-6 py-4">{getProductName(wo.product_id)}</td>
                                        <td className="px-6 py-4 text-muted-foreground text-xs">{wo.operation_type ?? "—"}</td>
                                        <td className="px-6 py-4 font-mono">
                                            {parseFloat(wo.planned_quantity).toLocaleString()} / {parseFloat(wo.produced_quantity || "0").toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            {wo.start_date ? new Date(wo.start_date).toLocaleDateString() : "—"} / {wo.end_date ? new Date(wo.end_date).toLocaleDateString() : "—"}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${getStatusColor(wo.status)}`}>
                                                {wo.status.replace("_", " ")}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right flex justify-end gap-1">
                                            <Link
                                                href={`/work-orders/${wo.id}`}
                                                className="text-amber-400 hover:text-amber-300 text-sm font-medium"
                                            >
                                                View
                                            </Link>
                                            <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted">
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-lg font-medium text-foreground">Create Work Order</h3>
                            <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
                        </div>

                        <form onSubmit={createWO} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">WO Number</label>
                                    <input
                                        type="text"
                                        required
                                        value={newWO.wo_number}
                                        onChange={(e) => setNewWO({ ...newWO, wo_number: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground font-mono"
                                        placeholder="e.g. WO-2024-001"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Product</label>
                                    <select
                                        required
                                        value={newWO.product_id}
                                        onChange={(e) => setNewWO({ ...newWO, product_id: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground"
                                    >
                                        <option value="" disabled className="text-muted-foreground">
                                            Select Product
                                        </option>
                                        {products.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">BOM (optional)</label>
                                <select
                                    value={newWO.bom_id}
                                    onChange={(e) => setNewWO({ ...newWO, bom_id: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground"
                                >
                                    <option value="">None</option>
                                    {boms.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.name} (v{b.version})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Planned Quantity</label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        min="0"
                                        required
                                        value={newWO.planned_quantity}
                                        onChange={(e) => setNewWO({ ...newWO, planned_quantity: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                                    <input
                                        type="date"
                                        value={newWO.start_date}
                                        onChange={(e) => setNewWO({ ...newWO, start_date: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground [color-scheme:dark]"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">End Date</label>
                                    <input
                                        type="date"
                                        value={newWO.end_date}
                                        onChange={(e) => setNewWO({ ...newWO, end_date: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground [color-scheme:dark]"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl shadow-lg transition-colors"
                                >
                                    Create Work Order
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
