"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { toId } from "@/lib/utils";
import {
    ArrowLeft,
    ShoppingCart,
    Plus,
    Trash2,
    Package,
    CheckCircle,
    Truck,
    XCircle,
} from "lucide-react";

interface SalesOrder {
    id: string;
    so_number: string;
    customer_id: string;
    status: string;
    expected_shipping_date: string | null;
    total_amount: string;
    created_at: string;
}

interface SalesOrderItem {
    id: string;
    so_id: string;
    product_id: string;
    quantity: string;
    unit_price: string;
    total_price: string;
    created_at: string;
}

interface Product {
    id: string;
    name: string;
    sku?: string;
    price?: string;
}

interface Customer {
    id: string;
    name: string;
}

const STATUS_FLOW: Record<string, { next: string[]; label: string; icon: React.ReactNode }> = {
    DRAFT: {
        next: ["CONFIRMED", "CANCELLED"],
        label: "Confirm order",
        icon: <CheckCircle className="w-4 h-4" />,
    },
    CONFIRMED: {
        next: ["SHIPPED", "CANCELLED"],
        label: "Mark shipped",
        icon: <Truck className="w-4 h-4" />,
    },
    SHIPPED: {
        next: ["DELIVERED", "CANCELLED"],
        label: "Mark delivered",
        icon: <CheckCircle className="w-4 h-4" />,
    },
    DELIVERED: { next: [], label: "", icon: null },
    CANCELLED: { next: [], label: "", icon: null },
};

function getStatusColor(status: string) {
    switch (status) {
        case "DRAFT":
            return "bg-zinc-500/10 text-muted-foreground border-zinc-500/20";
        case "CONFIRMED":
            return "bg-blue-500/10 text-blue-400 border-blue-500/20";
        case "SHIPPED":
            return "bg-amber-500/10 text-amber-400 border-amber-500/20";
        case "DELIVERED":
            return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        case "CANCELLED":
            return "bg-red-500/10 text-red-400 border-red-500/20";
        default:
            return "bg-zinc-500/10 text-muted-foreground border-zinc-500/20";
    }
}

export default function SalesOrderDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const [so, setSo] = useState<SalesOrder | null>(null);
    const [items, setItems] = useState<SalesOrderItem[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddLineModal, setShowAddLineModal] = useState(false);
    const [addLineForm, setAddLineForm] = useState({
        product_id: "",
        quantity: "",
        unit_price: "",
    });
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        fetchAll();
    }, [id]);

    const fetchAll = async () => {
        try {
            setLoading(true);
            const [soRes, itemsRes, productsRes, customersRes] = await Promise.all([
                api.get(`/sales/sales-orders/${id}`),
                api.get(`/sales/sales-orders/${id}/items`),
                api.get("/inventory/products"),
                api.get("/sales/customers"),
            ]);
            setSo(soRes.data);
            setItems(itemsRes.data || []);
            setProducts(productsRes.data || []);
            setCustomers(customersRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getCustomerName = (customerId: string) => {
        const c = customers.find((c) => toId(c.id) === toId(customerId));
        return c ? c.name : "—";
    };

    const getProductName = (productId: string) => {
        const p = products.find((p) => toId(p.id) === toId(productId));
        return p ? p.name : "—";
    };

    const getProductPrice = (productId: string) => {
        const p = products.find((p) => toId(p.id) === toId(productId));
        return p?.price ? parseFloat(String(p.price)) : 0;
    };

    const updateStatus = async (newStatus: string) => {
        try {
            setActionLoading(newStatus);
            await api.patch(`/sales/sales-orders/${id}/status`, { status: newStatus });
            setSo((prev) => (prev ? { ...prev, status: newStatus } : null));
        } catch (err: unknown) {
            const msg = err && typeof err === "object" && "response" in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
                : "Failed to update status";
            alert(msg || "Failed to update status");
        } finally {
            setActionLoading(null);
        }
    };

    const addLine = async (e: React.FormEvent) => {
        e.preventDefault();
        const qty = parseFloat(addLineForm.quantity);
        const unitPrice = parseFloat(addLineForm.unit_price);
        if (isNaN(qty) || isNaN(unitPrice) || qty <= 0 || unitPrice < 0) {
            alert("Invalid quantity or unit price");
            return;
        }
        const totalPrice = (qty * unitPrice).toFixed(2);
        try {
            await api.post("/sales/sales-orders/item", {
                so_id: id,
                product_id: addLineForm.product_id,
                quantity: addLineForm.quantity,
                unit_price: addLineForm.unit_price,
                total_price: totalPrice,
            });
            setShowAddLineModal(false);
            setAddLineForm({ product_id: "", quantity: "", unit_price: "" });
            fetchAll();
        } catch (err) {
            console.error(err);
            alert("Failed to add line item");
        }
    };

    const deleteLine = async (itemId: string) => {
        if (!confirm("Remove this line item?")) return;
        try {
            await api.delete(`/sales/sales-orders/items/${itemId}`);
            fetchAll();
        } catch (err) {
            console.error(err);
            alert("Failed to remove line item");
        }
    };

    const selectProduct = (productId: string) => {
        const price = getProductPrice(productId);
        setAddLineForm((prev) => ({
            ...prev,
            product_id: productId,
            unit_price: price > 0 ? String(price) : prev.unit_price,
        }));
    };

    if (loading && !so) {
        return (
            <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
                Loading sales order...
            </div>
        );
    }
    if (!so) {
        return (
            <div className="space-y-6">
                <Link
                    href="/sales-orders"
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Sales Orders
                </Link>
                <p className="text-muted-foreground">Sales order not found.</p>
            </div>
        );
    }

    const soIdStr = toId(so.id);
    const customerIdStr = toId(so.customer_id);
    const flow = STATUS_FLOW[so.status] || { next: [], label: "", icon: null };
    const isDraft = so.status === "DRAFT";

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-4">
                <Link
                    href="/sales-orders"
                    className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                >
                    <ArrowLeft className="w-4 h-4" />
                </Link>
                <div className="flex gap-4 items-center flex-1">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                        <ShoppingCart className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{so.so_number}</h1>
                        <p className="text-sm text-muted-foreground">
                            {getCustomerName(customerIdStr)} · Expected ship:{" "}
                            {so.expected_shipping_date
                                ? new Date(so.expected_shipping_date).toLocaleDateString()
                                : "—"}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card/80 border border-border rounded-2xl p-6">
                    <h3 className="text-sm font-medium text-muted-foreground mb-4">Order details</h3>
                    <dl className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Status</dt>
                            <dd>
                                <span
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${getStatusColor(
                                        so.status
                                    )}`}
                                >
                                    {so.status}
                                </span>
                            </dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Customer</dt>
                            <dd className="text-foreground">{getCustomerName(customerIdStr)}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Expected shipping</dt>
                            <dd className="text-foreground">
                                {so.expected_shipping_date
                                    ? new Date(so.expected_shipping_date).toLocaleDateString()
                                    : "—"}
                            </dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Total</dt>
                            <dd className="text-foreground font-mono">
                                ₹{parseFloat(so.total_amount).toLocaleString("en-IN")}
                            </dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Created</dt>
                            <dd className="text-foreground">{new Date(so.created_at).toLocaleString()}</dd>
                        </div>
                    </dl>
                </div>

                {flow.next.length > 0 && (
                    <div className="bg-card/80 border border-border rounded-2xl p-6">
                        <h3 className="text-sm font-medium text-muted-foreground mb-4">Actions</h3>
                        <div className="flex flex-wrap gap-2">
                            {flow.next.map((nextStatus) => (
                                <button
                                    key={nextStatus}
                                    disabled={actionLoading !== null}
                                    onClick={() => updateStatus(nextStatus)}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                        nextStatus === "CANCELLED"
                                            ? "bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30"
                                            : "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30"
                                    }`}
                                >
                                    {actionLoading === nextStatus ? (
                                        "…"
                                    ) : nextStatus === "CANCELLED" ? (
                                        <>
                                            <XCircle className="w-4 h-4" /> Cancel order
                                        </>
                                    ) : (
                                        <>
                                            {STATUS_FLOW[nextStatus]?.icon}
                                            {nextStatus === "CONFIRMED" && "Confirm order"}
                                            {nextStatus === "SHIPPED" && "Mark shipped"}
                                            {nextStatus === "DELIVERED" && "Mark delivered"}
                                        </>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-card/60 border border-border rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-border flex justify-between items-center">
                    <h3 className="font-medium text-foreground flex items-center gap-2">
                        <Package className="w-4 h-4 text-emerald-400" /> Line items
                    </h3>
                    {isDraft && (
                        <button
                            onClick={() => setShowAddLineModal(true)}
                            className="text-sm bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1"
                        >
                            <Plus className="w-4 h-4" /> Add line
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/30 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 text-left">Product</th>
                                <th className="px-4 py-3 text-right">Qty</th>
                                <th className="px-4 py-3 text-right">Unit price</th>
                                <th className="px-4 py-3 text-right">Total</th>
                                {isDraft && (
                                    <th className="px-4 py-3 text-right w-16"> </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-foreground">
                            {items.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={isDraft ? 5 : 4}
                                        className="px-4 py-8 text-center text-muted-foreground"
                                    >
                                        No line items yet.
                                        {isDraft && " Add a line to build the order total."}
                                    </td>
                                </tr>
                            ) : (
                                items.map((item) => (
                                    <tr key={toId(item.id)}>
                                        <td className="px-4 py-3 text-foreground">
                                            {getProductName(toId(item.product_id))}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono">
                                            {parseFloat(item.quantity).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono">
                                            ₹{parseFloat(item.unit_price).toLocaleString("en-IN")}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono">
                                            ₹{parseFloat(item.total_price).toLocaleString("en-IN")}
                                        </td>
                                        {isDraft && (
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => deleteLine(toId(item.id))}
                                                    className="text-muted-foreground hover:text-red-400 p-1 rounded hover:bg-muted"
                                                    title="Remove line"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showAddLineModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                            <h3 className="text-lg font-medium text-foreground">Add line item</h3>
                            <button
                                onClick={() => setShowAddLineModal(false)}
                                className="text-muted-foreground hover:text-foreground text-xl"
                            >
                                &times;
                            </button>
                        </div>
                        <form onSubmit={addLine} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Product</label>
                                <select
                                    required
                                    value={addLineForm.product_id}
                                    onChange={(e) => selectProduct(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                >
                                    <option value="">Select product</option>
                                    {products.map((p) => (
                                        <option key={toId(p.id)} value={toId(p.id)}>
                                            {p.name} {p.sku ? `(${p.sku})` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Quantity</label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        min="0.0001"
                                        required
                                        value={addLineForm.quantity}
                                        onChange={(e) =>
                                            setAddLineForm({ ...addLineForm, quantity: e.target.value })
                                        }
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Unit price (₹)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        value={addLineForm.unit_price}
                                        onChange={(e) =>
                                            setAddLineForm({ ...addLineForm, unit_price: e.target.value })
                                        }
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddLineModal(false)}
                                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl"
                                >
                                    Add line
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
