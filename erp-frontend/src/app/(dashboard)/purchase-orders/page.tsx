"use client";

import { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { Plus, Search, ShoppingCart, MoreVertical, FileText, X } from "lucide-react";

interface Vendor {
    id: string;
    name: string;
}

interface Product {
    id: string;
    name: string;
    sku: string;
    price: string;
}

interface PurchaseOrder {
    id: string;
    po_number: string;
    vendor_id: string;
    status: string;
    expected_delivery_date: string;
    total_amount: string;
    created_at: string;
}

interface PurchaseOrderItem {
    id: string;
    po_id: string;
    product_id: string;
    quantity: string;
    unit_price: string;
    total_price: string;
    created_at: string;
}

const emptyLineItem = { product_id: "", quantity: "", unit_price: "", total_price: "" };

export default function PurchaseOrdersPage() {
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [newPO, setNewPO] = useState({ vendor_id: "", po_number: "", expected_delivery_date: "", total_amount: "" });

    const [detailPO, setDetailPO] = useState<PurchaseOrder | null>(null);
    const [detailItems, setDetailItems] = useState<PurchaseOrderItem[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [showAddLine, setShowAddLine] = useState(false);
    const [lineItem, setLineItem] = useState(emptyLineItem);
    const [addingLine, setAddingLine] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [poRes, vendorRes, productRes] = await Promise.all([
                api.get("/purchase/purchase-orders"),
                api.get("/purchase/vendors"),
                api.get("/inventory/products"),
            ]);
            setPurchaseOrders(poRes.data || []);
            setVendors(vendorRes.data || []);
            setProducts(productRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const openDetail = async (po: PurchaseOrder) => {
        setDetailPO(po);
        setDetailItems([]);
        setShowAddLine(false);
        setLineItem(emptyLineItem);
        setDetailLoading(true);
        try {
            const [poRes, itemsRes] = await Promise.all([
                api.get(`/purchase/purchase-orders/${po.id}`),
                api.get(`/purchase/purchase-orders/${po.id}/items`),
            ]);
            setDetailPO(poRes.data);
            setDetailItems(itemsRes.data || []);
        } catch (err) {
            console.error(err);
            setDetailPO(null);
        } finally {
            setDetailLoading(false);
        }
    };

    const closeDetail = () => {
        setDetailPO(null);
        setDetailItems([]);
        setShowAddLine(false);
    };

    const createPO = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post("/purchase/purchase-orders", newPO);
            setShowModal(false);
            setNewPO({ vendor_id: "", po_number: "", expected_delivery_date: "", total_amount: "" });
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Failed to create Purchase Order");
        }
    };

    const addLineItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!detailPO) return;
        setAddingLine(true);
        try {
            await api.post("/purchase/purchase-orders/item", {
                po_id: detailPO.id,
                product_id: lineItem.product_id,
                quantity: lineItem.quantity,
                unit_price: lineItem.unit_price,
                total_price: lineItem.total_price,
            });
            setLineItem(emptyLineItem);
            setShowAddLine(false);
            const itemsRes = await api.get(`/purchase/purchase-orders/${detailPO.id}/items`);
            setDetailItems(itemsRes.data || []);
        } catch (err) {
            console.error(err);
            alert("Failed to add line item");
        } finally {
            setAddingLine(false);
        }
    };

    const getVendorName = (id: string) => {
        const v = vendors.find((v) => v.id === id);
        return v ? v.name : "Unknown Vendor";
    };

    const getProductName = (id: string) => {
        const p = products.find((p) => p.id === id);
        return p ? `${p.name} (${p.sku})` : "Unknown Product";
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "DRAFT": return "bg-zinc-500/10 text-muted-foreground border-zinc-500/20";
            case "ISSUED": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
            case "PARTIAL_RECEIPT": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
            case "COMPLETED": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            case "CANCELLED": return "bg-red-500/10 text-red-400 border-red-500/20";
            default: return "bg-zinc-500/10 text-muted-foreground border-zinc-500/20";
        }
    };

    const filteredPOs = useMemo(() => {
        if (!searchTerm.trim()) return purchaseOrders;
        const q = searchTerm.toLowerCase();
        return purchaseOrders.filter(
            (po) =>
                po.po_number.toLowerCase().includes(q) ||
                getVendorName(po.vendor_id).toLowerCase().includes(q)
        );
    }, [purchaseOrders, searchTerm, vendors]);

    const setLineItemWithTotal = (updates: Partial<typeof lineItem>) => {
        setLineItem((prev) => {
            const next = { ...prev, ...updates };
            const qty = parseFloat(next.quantity);
            const up = parseFloat(next.unit_price);
            if (!isNaN(qty) && !isNaN(up)) next.total_price = (qty * up).toFixed(2);
            return next;
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center bg-card/80 border border-border p-6 rounded-2xl shadow-xl">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                        <ShoppingCart className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Purchase Orders</h1>
                        <p className="text-sm text-muted-foreground">Manage procurements, vendors, and inbound deliveries.</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-foreground text-sm font-medium py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                >
                    <Plus className="w-4 h-4" />
                    Create PO
                </button>
            </div>

            <div className="bg-card/60 backdrop-blur-md border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-border flex gap-4 bg-card">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by PO Number or Vendor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground">
                        {filteredPOs.length} of {purchaseOrders.length} POs
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-muted/30 text-muted-foreground font-medium">
                            <tr>
                                <th className="px-6 py-4">PO Number</th>
                                <th className="px-6 py-4">Vendor</th>
                                <th className="px-6 py-4">Expected Delivery</th>
                                <th className="px-6 py-4">Total Amount</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-foreground">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Loading purchase orders...</td></tr>
                            ) : filteredPOs.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                    {searchTerm ? "No POs match your search." : "No purchase orders found. Start by creating one."}
                                </td></tr>
                            ) : (
                                filteredPOs.map((po) => (
                                    <tr
                                        key={po.id}
                                        onClick={() => openDetail(po)}
                                        className="hover:bg-muted/50 transition-colors cursor-pointer"
                                    >
                                        <td className="px-6 py-4 font-medium text-foreground flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-muted-foreground" />
                                            {po.po_number}
                                        </td>
                                        <td className="px-6 py-4">{getVendorName(po.vendor_id)}</td>
                                        <td className="px-6 py-4">{po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : "-"}</td>
                                        <td className="px-6 py-4 font-mono">₹{parseFloat(po.total_amount).toLocaleString("en-IN")}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${getStatusColor(po.status)}`}>
                                                {po.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={() => openDetail(po)}
                                                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                                            >
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

            {/* Create PO Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-lg font-medium text-foreground">Create Purchase Order</h3>
                            <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">&times;</button>
                        </div>
                        <form onSubmit={createPO} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">PO Number</label>
                                    <input
                                        type="text" required value={newPO.po_number} onChange={(e) => setNewPO({ ...newPO, po_number: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm text-foreground font-mono"
                                        placeholder="e.g. PO-2023-001"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Vendor</label>
                                    <select
                                        required value={newPO.vendor_id} onChange={(e) => setNewPO({ ...newPO, vendor_id: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm text-foreground"
                                    >
                                        <option value="" disabled className="text-muted-foreground">Select Vendor</option>
                                        {vendors.map((v) => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Expected Delivery Date</label>
                                    <input
                                        type="date" value={newPO.expected_delivery_date} onChange={(e) => setNewPO({ ...newPO, expected_delivery_date: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm text-foreground [color-scheme:dark]"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Total Amount (₹)</label>
                                    <input
                                        type="number" step="0.01" required value={newPO.total_amount} onChange={(e) => setNewPO({ ...newPO, total_amount: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm text-foreground"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-foreground text-sm font-medium rounded-xl shadow-lg transition-colors">Create PO</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* PO Detail Modal */}
            {detailPO && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30 shrink-0">
                            <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-blue-400" />
                                <h3 className="text-lg font-medium text-foreground">{detailPO.po_number}</h3>
                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${getStatusColor(detailPO.status)}`}>
                                    {detailPO.status}
                                </span>
                            </div>
                            <button onClick={closeDetail} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {detailLoading ? (
                                <div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Vendor</p>
                                            <p className="text-foreground font-medium">{getVendorName(detailPO.vendor_id)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Expected Delivery</p>
                                            <p className="text-foreground">{detailPO.expected_delivery_date ? new Date(detailPO.expected_delivery_date).toLocaleDateString() : "-"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Total Amount</p>
                                            <p className="text-foreground font-mono">₹{parseFloat(detailPO.total_amount).toLocaleString("en-IN")}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-medium text-muted-foreground">Line Items</h4>
                                        <button
                                            type="button"
                                            onClick={() => setShowAddLine(!showAddLine)}
                                            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                        >
                                            <Plus className="w-4 h-4" /> Add line
                                        </button>
                                    </div>

                                    {showAddLine && (
                                        <form onSubmit={addLineItem} className="mb-4 p-4 bg-muted/50 rounded-xl border border-border space-y-3">
                                            <div className="grid grid-cols-12 gap-3 items-end">
                                                <div className="col-span-5 space-y-1">
                                                    <label className="text-xs text-muted-foreground">Product</label>
                                                    <select
                                                        required
                                                        value={lineItem.product_id}
                                                        onChange={(e) => setLineItem({ ...lineItem, product_id: e.target.value })}
                                                        className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground"
                                                    >
                                                        <option value="" className="text-muted-foreground">Select product</option>
                                                        {products.map((p) => (
                                                            <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-span-2 space-y-1">
                                                    <label className="text-xs text-muted-foreground">Qty</label>
                                                    <input
                                                        type="number" step="0.01" required
                                                        value={lineItem.quantity}
                                                        onChange={(e) => setLineItemWithTotal({ quantity: e.target.value })}
                                                        className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground"
                                                    />
                                                </div>
                                                <div className="col-span-2 space-y-1">
                                                    <label className="text-xs text-muted-foreground">Unit price (₹)</label>
                                                    <input
                                                        type="number" step="0.01" required
                                                        value={lineItem.unit_price}
                                                        onChange={(e) => setLineItemWithTotal({ unit_price: e.target.value })}
                                                        className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground"
                                                    />
                                                </div>
                                                <div className="col-span-2 space-y-1">
                                                    <label className="text-xs text-muted-foreground">Total (₹)</label>
                                                    <input
                                                        type="number" step="0.01" required
                                                        value={lineItem.total_price}
                                                        onChange={(e) => setLineItem({ ...lineItem, total_price: e.target.value })}
                                                        className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground"
                                                    />
                                                </div>
                                                <div className="col-span-1 flex gap-1">
                                                    <button type="submit" disabled={addingLine} className="px-2 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-foreground text-sm disabled:opacity-70">
                                                        {addingLine ? "..." : "Add"}
                                                    </button>
                                                    <button type="button" onClick={() => { setShowAddLine(false); setLineItem(emptyLineItem); }} className="px-2 py-2 text-muted-foreground hover:text-foreground rounded-lg text-sm">
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </form>
                                    )}

                                    <div className="overflow-x-auto border border-border rounded-xl">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/30 text-muted-foreground">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Product</th>
                                                    <th className="px-4 py-3 text-right">Qty</th>
                                                    <th className="px-4 py-3 text-right">Unit price</th>
                                                    <th className="px-4 py-3 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 text-foreground">
                                                {detailItems.length === 0 ? (
                                                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No line items. Add one above.</td></tr>
                                                ) : (
                                                    detailItems.map((item) => (
                                                        <tr key={item.id}>
                                                            <td className="px-4 py-3 text-foreground">{getProductName(item.product_id)}</td>
                                                            <td className="px-4 py-3 text-right">{item.quantity}</td>
                                                            <td className="px-4 py-3 text-right font-mono">₹{parseFloat(item.unit_price).toLocaleString("en-IN")}</td>
                                                            <td className="px-4 py-3 text-right font-mono">₹{parseFloat(item.total_price).toLocaleString("en-IN")}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
