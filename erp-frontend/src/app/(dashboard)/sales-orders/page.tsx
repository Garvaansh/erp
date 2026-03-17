"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toId } from "@/lib/utils";
import { Plus, Search, ShoppingCart, MoreVertical, FileText, Eye } from "lucide-react";

interface Customer {
    id: string;
    name: string;
}

interface SalesOrder {
    id: string;
    so_number: string;
    customer_id: string;
    status: string;
    expected_shipping_date: string;
    total_amount: string;
    created_at: string;
}

export default function SalesOrdersPage() {
    const router = useRouter();
    const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("");

    const [showModal, setShowModal] = useState(false);
    const [newSO, setNewSO] = useState({
        customer_id: "",
        so_number: "",
        expected_shipping_date: "",
        total_amount: "0",
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [soRes, customerRes] = await Promise.all([
                api.get("/sales/sales-orders"),
                api.get("/sales/customers"),
            ]);
            setSalesOrders(soRes.data || []);
            setCustomers(customerRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const createSO = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { data } = await api.post("/sales/sales-orders", {
                ...newSO,
                total_amount: newSO.total_amount || "0",
            });
            setShowModal(false);
            setNewSO({
                customer_id: "",
                so_number: "",
                expected_shipping_date: "",
                total_amount: "0",
            });
            // Navigate to detail to add line items if total is 0
            if (data?.id) {
                router.push(`/sales-orders/${toId(data.id)}`);
            } else {
                fetchData();
            }
        } catch (err) {
            console.error(err);
            alert("Failed to create Sales Order");
        }
    };

    const getCustomerName = (id: string) => {
        const c = customers.find((c) => toId(c.id) === toId(id));
        return c ? c.name : "Unknown Customer";
    };

    const filteredOrders = salesOrders.filter((so) => {
        const matchSearch =
            so.so_number.toLowerCase().includes(search.toLowerCase()) ||
            getCustomerName(so.customer_id).toLowerCase().includes(search.toLowerCase());
        const matchStatus = !statusFilter || so.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const getStatusColor = (status: string) => {
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
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center bg-card/80 border border-border p-6 rounded-2xl shadow-xl">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                        <ShoppingCart className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
                            Sales Orders
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Manage customer orders, shipments, and outbound sales.
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => setShowModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(5,150,105,0.3)]"
                >
                    <Plus className="w-4 h-4" />
                    Create Sales Order
                </button>
            </div>

            <div className="bg-card/60 backdrop-blur-md border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-border flex flex-wrap gap-4 bg-card">
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by SO number or customer..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-sm text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                        <option value="">All statuses</option>
                        <option value="DRAFT">DRAFT</option>
                        <option value="CONFIRMED">CONFIRMED</option>
                        <option value="SHIPPED">SHIPPED</option>
                        <option value="DELIVERED">DELIVERED</option>
                        <option value="CANCELLED">CANCELLED</option>
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-muted/30 text-muted-foreground font-medium">
                            <tr>
                                <th className="px-6 py-4">SO Number</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Expected Shipping</th>
                                <th className="px-6 py-4">Total Amount</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-foreground">
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-6 py-8 text-center text-muted-foreground"
                                    >
                                        Loading sales orders...
                                    </td>
                                </tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-6 py-12 text-center text-muted-foreground"
                                    >
                                        {salesOrders.length === 0
                                            ? "No sales orders found. Start by creating one."
                                            : "No orders match the current filters."}
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((so) => (
                                    <tr
                                        key={toId(so.id)}
                                        className="hover:bg-muted/50 transition-colors"
                                    >
                                        <td className="px-6 py-4 font-medium text-foreground flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-muted-foreground" />
                                            {so.so_number}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getCustomerName(so.customer_id)}
                                        </td>
                                        <td className="px-6 py-4">
                                            {so.expected_shipping_date
                                                ? new Date(
                                                      so.expected_shipping_date
                                                  ).toLocaleDateString()
                                                : "-"}
                                        </td>
                                        <td className="px-6 py-4 font-mono">
                                            ₹
                                            {parseFloat(
                                                so.total_amount
                                            ).toLocaleString("en-IN")}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${getStatusColor(
                                                    so.status
                                                )}`}
                                            >
                                                {so.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right flex justify-end gap-1 items-center">
                                            <Link
                                                href={`/sales-orders/${toId(so.id)}`}
                                                className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                                            >
                                                <Eye className="w-4 h-4" /> View
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
                            <h3 className="text-lg font-medium text-foreground">
                                Create Sales Order
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                &times;
                            </button>
                        </div>

                        <form
                            onSubmit={createSO}
                            className="p-6 space-y-4"
                        >
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">
                                        SO Number
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={newSO.so_number}
                                        onChange={(e) =>
                                            setNewSO({
                                                ...newSO,
                                                so_number: e.target.value,
                                            })
                                        }
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm text-foreground font-mono"
                                        placeholder="e.g. SO-2023-001"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">
                                        Customer
                                    </label>
                                    <select
                                        required
                                        value={newSO.customer_id}
                                        onChange={(e) =>
                                            setNewSO({
                                                ...newSO,
                                                customer_id: e.target.value,
                                            })
                                        }
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm text-foreground"
                                    >
                                        <option
                                            value=""
                                            disabled
                                            className="text-muted-foreground"
                                        >
                                            Select Customer
                                        </option>
                                        {customers.map((c) => (
                                            <option
                                                key={c.id}
                                                value={c.id}
                                            >
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">
                                        Expected Shipping Date
                                    </label>
                                    <input
                                        type="date"
                                        value={newSO.expected_shipping_date}
                                        onChange={(e) =>
                                            setNewSO({
                                                ...newSO,
                                                expected_shipping_date:
                                                    e.target.value,
                                            })
                                        }
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm text-foreground [color-scheme:dark]"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">
                                        Total Amount (₹) — optional, can add lines in detail
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={newSO.total_amount}
                                        onChange={(e) =>
                                            setNewSO({
                                                ...newSO,
                                                total_amount: e.target.value || "0",
                                            })
                                        }
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm text-foreground"
                                        placeholder="0.00"
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
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl shadow-lg transition-colors"
                                >
                                    Create Sales Order
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
