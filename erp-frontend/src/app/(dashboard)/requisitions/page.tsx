"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import {
    ListChecks,
    Plus,
    Search,
    X,
    FileText,
    ChevronRight,
    Package,
    Calendar,
    DollarSign,
} from "lucide-react";

interface Requisition {
    id: string;
    req_number: string;
    department: string | null;
    status: string;
    expected_delivery_date: string | null;
    budget: string | null;
    created_at: string;
    updated_at: string;
}

interface RequisitionItem {
    id: string;
    requisition_id: string;
    product_id: string;
    quantity: string;
    notes: string | null;
    created_at: string;
}

interface Product {
    id: string;
    name: string;
    sku: string;
}

const statusColors: Record<string, string> = {
    DRAFT: "bg-muted/50 text-muted-foreground",
    SUBMITTED: "bg-blue-500/10 text-blue-400",
    APPROVED: "bg-emerald-500/10 text-emerald-400",
    REJECTED: "bg-red-500/10 text-red-400",
    ORDERED: "bg-violet-500/10 text-violet-400",
};

export default function RequisitionsPage() {
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        department: "",
        expected_delivery_date: "",
        budget: "",
        items: [] as { product_id: string; quantity: string; notes: string }[],
    });
    const [saving, setSaving] = useState(false);

    const [detailReq, setDetailReq] = useState<Requisition | null>(null);
    const [detailItems, setDetailItems] = useState<RequisitionItem[]>([]);
    const [detailProducts, setDetailProducts] = useState<Product[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [statusModal, setStatusModal] = useState(false);
    const [newStatus, setNewStatus] = useState("");
    const [updatingStatus, setUpdatingStatus] = useState(false);

    useEffect(() => {
        fetchRequisitions();
        fetchProducts();
    }, []);

    const fetchRequisitions = async () => {
        try {
            setLoading(true);
            const res = await api.get("/purchase/requisitions", { params: { limit: 100, offset: 0 } });
            setRequisitions(res.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await api.get("/inventory/products");
            setProducts(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const openDetail = async (req: Requisition) => {
        setDetailReq(req);
        setDetailItems([]);
        setDetailLoading(true);
        try {
            const [itemsRes, prodRes] = await Promise.all([
                api.get(`/purchase/requisitions/${req.id}/items`),
                api.get("/inventory/products"),
            ]);
            setDetailItems(itemsRes.data || []);
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

    const filtered = requisitions.filter(
        (r) =>
            r.req_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.department && r.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
            r.status.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const addLine = () => {
        setForm((f) => ({
            ...f,
            items: [...f.items, { product_id: "", quantity: "", notes: "" }],
        }));
    };

    const removeLine = (i: number) => {
        setForm((f) => ({
            ...f,
            items: f.items.filter((_, idx) => idx !== i),
        }));
    };

    const updateLine = (i: number, field: "product_id" | "quantity" | "notes", value: string) => {
        setForm((f) => {
            const next = [...f.items];
            next[i] = { ...next[i], [field]: value };
            return { ...f, items: next };
        });
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const validItems = form.items.filter((row) => row.product_id && row.quantity);
        if (validItems.length === 0) {
            alert("Add at least one item with product and quantity.");
            return;
        }
        setSaving(true);
        try {
            await api.post("/purchase/requisitions", {
                department: form.department || null,
                expected_delivery_date: form.expected_delivery_date || null,
                budget: form.budget || null,
                items: validItems.map((row) => ({
                    product_id: row.product_id,
                    quantity: row.quantity,
                    notes: row.notes || null,
                })),
            });
            setShowModal(false);
            setForm({ department: "", expected_delivery_date: "", budget: "", items: [] });
            fetchRequisitions();
        } catch (err) {
            console.error(err);
            alert("Failed to create requisition.");
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateStatus = async () => {
        if (!detailReq || !newStatus) return;
        setUpdatingStatus(true);
        try {
            await api.patch(`/purchase/requisitions/${detailReq.id}/status`, { status: newStatus });
            setStatusModal(false);
            setNewStatus("");
            setDetailReq({ ...detailReq, status: newStatus });
            fetchRequisitions();
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
                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                        <ListChecks className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
                            Purchase Requisitions
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Create and track material requests before converting to purchase orders.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setForm({ department: "", expected_delivery_date: "", budget: "", items: [] });
                        setShowModal(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    New Requisition
                </button>
            </div>

            <div className="bg-card/60 border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-border flex gap-4 bg-card">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by req number, department, status..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm text-foreground"
                        />
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground">
                        {filtered.length} requisitions
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-muted/30 text-muted-foreground font-medium">
                            <tr>
                                <th className="px-6 py-4">Req #</th>
                                <th className="px-6 py-4">Department</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Expected</th>
                                <th className="px-6 py-4">Budget</th>
                                <th className="px-6 py-4">Created</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-foreground">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                        Loading...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-muted-foreground">
                                        No requisitions yet. Create one to get started.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((r) => (
                                    <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-6 py-4 font-medium">{r.req_number}</td>
                                        <td className="px-6 py-4 text-muted-foreground">{r.department || "—"}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${statusColors[r.status] || "bg-muted/50 text-muted-foreground"}`}>
                                                {r.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground text-xs">
                                            {r.expected_delivery_date ? new Date(r.expected_delivery_date).toLocaleDateString("en-IN") : "—"}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">{r.budget ?? "—"}</td>
                                        <td className="px-6 py-4 text-muted-foreground text-xs">
                                            {new Date(r.created_at).toLocaleDateString("en-IN")}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() => openDetail(r)}
                                                className="text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center gap-1 ml-auto"
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
                                <FileText className="w-5 h-5 text-blue-400" /> New Requisition
                            </h3>
                            <button type="button" onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto flex-1">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Department</label>
                                    <input
                                        type="text"
                                        value={form.department}
                                        onChange={(e) => setForm({ ...form, department: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                        placeholder="e.g. Production"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Expected delivery</label>
                                    <input
                                        type="date"
                                        value={form.expected_delivery_date}
                                        onChange={(e) => setForm({ ...form, expected_delivery_date: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Budget</label>
                                <input
                                    type="text"
                                    value={form.budget}
                                    onChange={(e) => setForm({ ...form, budget: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                    placeholder="Optional"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-muted-foreground">Items</label>
                                <button type="button" onClick={addLine} className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
                                    <Plus className="w-4 h-4" /> Add line
                                </button>
                            </div>
                            <div className="space-y-2">
                                {form.items.map((row, i) => (
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
                                <button type="submit" disabled={saving || form.items.length === 0} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl flex items-center gap-2">
                                    {saving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail sidebar / modal */}
            {detailReq && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30 shrink-0">
                            <h3 className="text-lg font-medium text-foreground">{detailReq.req_number}</h3>
                            <button type="button" onClick={() => setDetailReq(null)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${statusColors[detailReq.status] || ""}`}>
                                    {detailReq.status}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setStatusModal(true)}
                                    className="text-xs text-blue-400 hover:text-blue-300"
                                >
                                    Change status
                                </button>
                            </div>
                            {(detailReq.department || detailReq.expected_delivery_date || detailReq.budget) && (
                                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                                    {detailReq.department && <span>Dept: {detailReq.department}</span>}
                                    {detailReq.expected_delivery_date && (
                                        <span>Expected: {new Date(detailReq.expected_delivery_date).toLocaleDateString("en-IN")}</span>
                                    )}
                                    {detailReq.budget != null && <span>Budget: {detailReq.budget}</span>}
                                </div>
                            )}
                            <div>
                                <h4 className="text-xs font-medium text-muted-foreground mb-2">Items</h4>
                                {detailLoading ? (
                                    <p className="text-sm text-muted-foreground">Loading...</p>
                                ) : detailItems.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No items.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {detailItems.map((item) => (
                                            <li key={item.id} className="flex justify-between text-sm">
                                                <span>{getProductName(item.product_id)}</span>
                                                <span className="text-muted-foreground">× {item.quantity}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {statusModal && detailReq && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
                        <h4 className="text-lg font-medium text-foreground mb-4">Update status</h4>
                        <select
                            value={newStatus}
                            onChange={(e) => setNewStatus(e.target.value)}
                            className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground mb-4"
                        >
                            <option value="">Select...</option>
                            {["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "ORDERED"].map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setStatusModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50">
                                Cancel
                            </button>
                            <button type="button" onClick={handleUpdateStatus} disabled={!newStatus || updatingStatus} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl">
                                Update
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
