"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import {
    PackageCheck,
    Plus,
    Search,
    X,
    Truck,
    ChevronRight,
    Package,
    MapPin,
} from "lucide-react";

interface Shipment {
    id: string;
    shipment_number: string;
    sales_order_id: string | null;
    warehouse_id: string | null;
    carrier_name: string | null;
    tracking_number: string | null;
    status: string;
    shipped_at: string | null;
    delivered_at: string | null;
    created_at: string;
}

interface ShipmentLine {
    id: string;
    shipment_id: string;
    product_id: string;
    quantity: string;
    created_at: string;
}

interface Product {
    id: string;
    name: string;
    sku: string;
}

interface Warehouse {
    id: string;
    name: string;
}

interface SalesOrder {
    id: string;
    so_number: string;
}

const statusColors: Record<string, string> = {
    PENDING: "bg-muted/50 text-muted-foreground",
    PACKED: "bg-amber-500/10 text-amber-400",
    DISPATCHED: "bg-blue-500/10 text-blue-400",
    IN_TRANSIT: "bg-violet-500/10 text-violet-400",
    DELIVERED: "bg-emerald-500/10 text-emerald-400",
};

export default function ShipmentsPage() {
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        sales_order_id: "",
        warehouse_id: "",
        carrier_name: "",
        tracking_number: "",
        lines: [] as { product_id: string; quantity: string }[],
    });
    const [saving, setSaving] = useState(false);

    const [detailShipment, setDetailShipment] = useState<Shipment | null>(null);
    const [detailLines, setDetailLines] = useState<ShipmentLine[]>([]);
    const [detailProducts, setDetailProducts] = useState<Product[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [statusModal, setStatusModal] = useState(false);
    const [newStatus, setNewStatus] = useState("");
    const [updatingStatus, setUpdatingStatus] = useState(false);

    useEffect(() => {
        fetchShipments();
        fetchOptions();
    }, []);

    const fetchShipments = async () => {
        try {
            setLoading(true);
            const res = await api.get("/sales/shipments", { params: { limit: 100, offset: 0 } });
            setShipments(res.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchOptions = async () => {
        try {
            const [prodRes, whRes, soRes] = await Promise.all([
                api.get("/inventory/products"),
                api.get("/inventory/warehouses"),
                api.get("/sales/sales-orders"),
            ]);
            setProducts(prodRes.data || []);
            setWarehouses(whRes.data || []);
            setSalesOrders(soRes.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const openDetail = async (ship: Shipment) => {
        setDetailShipment(ship);
        setDetailLines([]);
        setDetailLoading(true);
        try {
            const [linesRes, prodRes] = await Promise.all([
                api.get(`/sales/shipments/${ship.id}/lines`),
                api.get("/inventory/products"),
            ]);
            setDetailLines(linesRes.data || []);
            setDetailProducts(prodRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setDetailLoading(false);
        }
    };

    const getProductName = (id: string) => {
        const p = detailProducts.find((x) => x.id === id) || products.find((x) => x.id === id);
        return p ? p.name : id.slice(0, 8);
    };

    const filtered = shipments.filter(
        (s) =>
            s.shipment_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.tracking_number && s.tracking_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
            s.status.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const addLine = () => {
        setForm((f) => ({
            ...f,
            lines: [...f.lines, { product_id: "", quantity: "" }],
        }));
    };

    const removeLine = (i: number) => {
        setForm((f) => ({
            ...f,
            lines: f.lines.filter((_, idx) => idx !== i),
        }));
    };

    const updateLine = (i: number, field: "product_id" | "quantity", value: string) => {
        setForm((f) => {
            const next = [...f.lines];
            next[i] = { ...next[i], [field]: value };
            return { ...f, lines: next };
        });
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const validLines = form.lines.filter((row) => row.product_id && row.quantity);
        if (validLines.length === 0) {
            alert("Add at least one line with product and quantity.");
            return;
        }
        setSaving(true);
        try {
            await api.post("/sales/shipments", {
                sales_order_id: form.sales_order_id || null,
                warehouse_id: form.warehouse_id || null,
                carrier_name: form.carrier_name || null,
                tracking_number: form.tracking_number || null,
                lines: validLines.map((row) => ({ product_id: row.product_id, quantity: row.quantity })),
            });
            setShowModal(false);
            setForm({ sales_order_id: "", warehouse_id: "", carrier_name: "", tracking_number: "", lines: [] });
            fetchShipments();
        } catch (err) {
            console.error(err);
            alert("Failed to create shipment.");
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateStatus = async () => {
        if (!detailShipment || !newStatus) return;
        setUpdatingStatus(true);
        try {
            await api.patch(`/sales/shipments/${detailShipment.id}/status`, { status: newStatus });
            setStatusModal(false);
            setNewStatus("");
            setDetailShipment({ ...detailShipment, status: newStatus });
            fetchShipments();
        } catch (err) {
            console.error(err);
            alert("Failed to update status.");
        } finally {
            setUpdatingStatus(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center bg-card/80 border border-border p-6 rounded-2xl shadow-xl">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center border border-teal-500/20">
                        <PackageCheck className="w-6 h-6 text-teal-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
                            Shipments
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Create and track outbound shipments, carriers, and delivery status.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setForm({ sales_order_id: "", warehouse_id: "", carrier_name: "", tracking_number: "", lines: [] });
                        setShowModal(true);
                    }}
                    className="bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    New Shipment
                </button>
            </div>

            <div className="bg-card/60 border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-border flex gap-4 bg-card">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by shipment #, tracking, status..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-sm text-foreground"
                        />
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground">
                        {filtered.length} shipments
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-muted/30 text-muted-foreground font-medium">
                            <tr>
                                <th className="px-6 py-4">Shipment #</th>
                                <th className="px-6 py-4">Carrier</th>
                                <th className="px-6 py-4">Tracking</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Created</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-foreground">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        Loading...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                                        No shipments yet. Create one to get started.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((s) => (
                                    <tr key={s.id} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-6 py-4 font-medium">{s.shipment_number}</td>
                                        <td className="px-6 py-4 text-muted-foreground">{s.carrier_name || "—"}</td>
                                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{s.tracking_number || "—"}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${statusColors[s.status] || "bg-muted/50 text-muted-foreground"}`}>
                                                {s.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground text-xs">
                                            {new Date(s.created_at).toLocaleDateString("en-IN")}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() => openDetail(s)}
                                                className="text-teal-400 hover:text-teal-300 text-sm font-medium flex items-center gap-1 ml-auto"
                                            >
                                                View <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30 shrink-0">
                            <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                                <Truck className="w-5 h-5 text-teal-400" /> New Shipment
                            </h3>
                            <button type="button" onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto flex-1">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Sales order (optional)</label>
                                    <select
                                        value={form.sales_order_id}
                                        onChange={(e) => setForm({ ...form, sales_order_id: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                    >
                                        <option value="">—</option>
                                        {salesOrders.map((so) => (
                                            <option key={so.id} value={so.id}>{so.so_number}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Warehouse (optional)</label>
                                    <select
                                        value={form.warehouse_id}
                                        onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                    >
                                        <option value="">—</option>
                                        {warehouses.map((wh) => (
                                            <option key={wh.id} value={wh.id}>{wh.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Carrier</label>
                                    <input
                                        type="text"
                                        value={form.carrier_name}
                                        onChange={(e) => setForm({ ...form, carrier_name: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                        placeholder="e.g. Blue Dart"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Tracking #</label>
                                    <input
                                        type="text"
                                        value={form.tracking_number}
                                        onChange={(e) => setForm({ ...form, tracking_number: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                        placeholder="Optional"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-muted-foreground">Lines *</label>
                                <button type="button" onClick={addLine} className="text-teal-400 hover:text-teal-300 text-sm flex items-center gap-1">
                                    <Plus className="w-4 h-4" /> Add line
                                </button>
                            </div>
                            <div className="space-y-2">
                                {form.lines.map((row, i) => (
                                    <div key={i} className="flex gap-2 items-center">
                                        <select
                                            value={row.product_id}
                                            onChange={(e) => updateLine(i, "product_id", e.target.value)}
                                            className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground"
                                            required
                                        >
                                            <option value="">Select product</option>
                                            {products.map((p) => (
                                                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                            ))}
                                        </select>
                                        <input
                                            type="text"
                                            value={row.quantity}
                                            onChange={(e) => updateLine(i, "quantity", e.target.value)}
                                            placeholder="Qty"
                                            className="w-20 px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground"
                                            required
                                        />
                                        <button type="button" onClick={() => removeLine(i)} className="text-red-400 hover:text-red-300 p-1">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 flex justify-end gap-3 border-t border-border">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50">
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving || form.lines.length === 0} className="px-5 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl flex items-center gap-2">
                                    {saving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail modal */}
            {detailShipment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30 shrink-0">
                            <h3 className="text-lg font-medium text-foreground">{detailShipment.shipment_number}</h3>
                            <button type="button" onClick={() => setDetailShipment(null)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${statusColors[detailShipment.status] || ""}`}>
                                    {detailShipment.status}
                                </span>
                                <button type="button" onClick={() => setStatusModal(true)} className="text-xs text-teal-400 hover:text-teal-300">
                                    Change status
                                </button>
                            </div>
                            {(detailShipment.carrier_name || detailShipment.tracking_number) && (
                                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                                    {detailShipment.carrier_name && <span>Carrier: {detailShipment.carrier_name}</span>}
                                    {detailShipment.tracking_number && <span className="font-mono">Tracking: {detailShipment.tracking_number}</span>}
                                </div>
                            )}
                            <div>
                                <h4 className="text-xs font-medium text-muted-foreground mb-2">Lines</h4>
                                {detailLoading ? (
                                    <p className="text-sm text-muted-foreground">Loading...</p>
                                ) : detailLines.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No lines.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {detailLines.map((line) => (
                                            <li key={line.id} className="flex justify-between text-sm">
                                                <span>{getProductName(line.product_id)}</span>
                                                <span className="text-muted-foreground">× {line.quantity}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {statusModal && detailShipment && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
                        <h4 className="text-lg font-medium text-foreground mb-4">Update status</h4>
                        <select
                            value={newStatus}
                            onChange={(e) => setNewStatus(e.target.value)}
                            className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground mb-4"
                        >
                            <option value="">Select...</option>
                            {["PENDING", "PACKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED"].map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setStatusModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50">
                                Cancel
                            </button>
                            <button type="button" onClick={handleUpdateStatus} disabled={!newStatus || updatingStatus} className="px-5 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl">
                                Update
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
