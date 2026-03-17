"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import Link from "next/link";
import { Plus, Factory, Search, FileText } from "lucide-react";

interface Product {
    id: string;
    name: string;
    sku?: string;
}
interface ProductionLine {
    id: string;
    name: string;
}
interface ProductionOrder {
    id: string;
    po_number: string;
    product_id: string;
    quantity: string;
    start_date: string | null;
    end_date: string | null;
    production_line_id: string | null;
    status: string;
    created_at: string;
}

export default function ProductionOrdersPage() {
    const [orders, setOrders] = useState<ProductionOrder[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [lines, setLines] = useState<ProductionLine[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        po_number: "",
        product_id: "",
        quantity: "",
        start_date: "",
        end_date: "",
        production_line_id: "",
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [ordersRes, productsRes, linesRes] = await Promise.all([
                api.get("/manufacturing/production-orders"),
                api.get("/inventory/products"),
                api.get("/manufacturing/production-lines").catch(() => ({ data: [] })),
            ]);
            setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
            setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
            setLines(Array.isArray(linesRes.data) ? linesRes.data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const createPO = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: Record<string, string> = {
                po_number: form.po_number,
                product_id: form.product_id,
                quantity: form.quantity,
            };
            if (form.start_date) payload.start_date = form.start_date;
            if (form.end_date) payload.end_date = form.end_date;
            if (form.production_line_id) payload.production_line_id = form.production_line_id;
            await api.post("/manufacturing/production-orders", payload);
            setShowModal(false);
            setForm({ po_number: "", product_id: "", quantity: "", start_date: "", end_date: "", production_line_id: "" });
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Failed to create production order");
        }
    };

    const getProductName = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
    const getLineName = (id: string | null) => (id ? lines.find((l) => l.id === id)?.name ?? "—" : "—");
    const getStatusColor = (s: string) => {
        switch (s) {
            case "PLANNED": return "bg-zinc-500/10 text-muted-foreground border-zinc-500/20";
            case "RELEASED": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
            case "IN_PROGRESS": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
            case "COMPLETED": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            case "CANCELLED": return "bg-red-500/10 text-red-400 border-red-500/20";
            default: return "bg-zinc-500/10 text-muted-foreground border-zinc-500/20";
        }
    };

    const filtered = orders.filter(
        (o) =>
            o.po_number.toLowerCase().includes(search.toLowerCase()) ||
            getProductName(o.product_id).toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center bg-card/80 border border-border p-6 rounded-2xl shadow-xl">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
                        <Factory className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Production Orders</h1>
                        <p className="text-sm text-muted-foreground">Create production orders and generate work orders (Cutting, Welding, Polishing, Inspection).</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all"
                >
                    <Plus className="w-4 h-4" /> New Production Order
                </button>
            </div>

            <div className="bg-card/60 backdrop-blur-md border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-border flex gap-4 bg-card">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by PO number or product..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-muted/30 text-muted-foreground font-medium">
                            <tr>
                                <th className="px-6 py-4">PO Number</th>
                                <th className="px-6 py-4">Product</th>
                                <th className="px-6 py-4">Quantity</th>
                                <th className="px-6 py-4">Production Line</th>
                                <th className="px-6 py-4">Start / End</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-foreground">
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No production orders. Create one to get started.</td></tr>
                            ) : (
                                filtered.map((o) => (
                                    <tr key={o.id} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-6 py-4 font-medium flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-muted-foreground" />
                                            {o.po_number}
                                        </td>
                                        <td className="px-6 py-4">{getProductName(o.product_id)}</td>
                                        <td className="px-6 py-4 font-mono">{parseFloat(o.quantity).toLocaleString()}</td>
                                        <td className="px-6 py-4">{getLineName(o.production_line_id)}</td>
                                        <td className="px-6 py-4">
                                            {o.start_date ? new Date(o.start_date).toLocaleDateString() : "—"} / {o.end_date ? new Date(o.end_date).toLocaleDateString() : "—"}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${getStatusColor(o.status)}`}>
                                                {o.status.replace("_", " ")}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link href={`/production-orders/${o.id}`} className="text-amber-400 hover:text-amber-300 text-sm font-medium">
                                                View
                                            </Link>
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
                    <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-lg font-medium text-foreground">New Production Order</h3>
                            <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
                        </div>
                        <form onSubmit={createPO} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">PO Number</label>
                                    <input
                                        type="text"
                                        required
                                        value={form.po_number}
                                        onChange={(e) => setForm({ ...form, po_number: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm font-mono text-foreground"
                                        placeholder="e.g. PO-2024-001"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Product</label>
                                    <select
                                        required
                                        value={form.product_id}
                                        onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground"
                                    >
                                        <option value="">Select</option>
                                        {products.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Quantity</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    required
                                    value={form.quantity}
                                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground"
                                />
                            </div>
                            {lines.length > 0 && (
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Production Line</label>
                                    <select
                                        value={form.production_line_id}
                                        onChange={(e) => setForm({ ...form, production_line_id: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground"
                                    >
                                        <option value="">None</option>
                                        {lines.map((l) => (
                                            <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                                    <input
                                        type="date"
                                        value={form.start_date}
                                        onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground [color-scheme:dark]"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">End Date</label>
                                    <input
                                        type="date"
                                        value={form.end_date}
                                        onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground [color-scheme:dark]"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                                <button type="submit" className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
