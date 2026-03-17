"use client";

import { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import {
    Plus,
    Search,
    FileText,
    MoreVertical,
    DollarSign,
    Printer,
    X,
    ChevronRight,
} from "lucide-react";

interface Customer {
    id: string;
    name: string;
}

interface SalesOrder {
    id: string;
    so_number: string;
    customer_id: string;
    status: string;
    total_amount: string;
}

interface Invoice {
    id: string;
    customer_id: string;
    so_id: string | null;
    invoice_number: string;
    invoice_date: string;
    due_date: string | null;
    total_amount: string;
    status: string;
    created_at: string;
    place_of_supply_state?: string | null;
    invoice_type?: string | null;
    subtotal?: string | null;
    cgst_total?: string | null;
    sgst_total?: string | null;
    igst_total?: string | null;
}

interface Payment {
    id: string;
    invoice_id: string;
    amount: string;
    payment_date: string;
    payment_method: string | null;
    reference_number: string | null;
    created_at: string;
}

interface InvoiceDetailResponse {
    invoice: Invoice;
    payments: Payment[];
    line_items: {
        id: string;
        description: string;
        quantity: string;
        unit_price: string;
        total_line: string;
        hsn_sac?: string | null;
        taxable_value?: string | null;
        cgst?: string | null;
        sgst?: string | null;
        igst?: string | null;
    }[];
    paid_total: number;
    balance_due: number;
    overdue: boolean;
}

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [nextNumber, setNextNumber] = useState<string | null>(null);
    const [newInvoice, setNewInvoice] = useState({
        customer_id: "",
        so_id: "",
        invoice_number: "",
        invoice_date: new Date().toISOString().slice(0, 10),
        due_date: "",
        total_amount: "",
        status: "DRAFT",
        place_of_supply_state: "",
        invoice_type: "TAX_INVOICE",
        subtotal: "",
        cgst_total: "",
        sgst_total: "",
        igst_total: "",
    });

    const [detailId, setDetailId] = useState<string | null>(null);
    const [detail, setDetail] = useState<InvoiceDetailResponse | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentForm, setPaymentForm] = useState({
        amount: "",
        payment_date: new Date().toISOString().slice(0, 10),
        payment_method: "BANK_TRANSFER",
        reference_number: "",
    });
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (detailId) {
            fetchDetail(detailId);
        } else {
            setDetail(null);
        }
    }, [detailId]);

    useEffect(() => {
        if (showModal) {
            api.get("/sales/invoices/next-number")
                .then((r) => setNextNumber((r.data as { suggested?: string })?.suggested ?? null))
                .catch(() => setNextNumber(null));
        } else {
            setNextNumber(null);
        }
    }, [showModal]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [invRes, custRes, soRes] = await Promise.all([
                api.get("/sales/invoices"),
                api.get("/sales/customers"),
                api.get("/sales/sales-orders"),
            ]);
            setInvoices(invRes.data || []);
            setCustomers(custRes.data || []);
            setSalesOrders(soRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDetail = async (id: string) => {
        try {
            setDetailLoading(true);
            const res = await api.get(`/sales/invoices/${id}`);
            setDetail(res.data as InvoiceDetailResponse);
        } catch (err) {
            console.error(err);
            setDetail(null);
        } finally {
            setDetailLoading(false);
        }
    };

    const filteredInvoices = useMemo(() => {
        if (!search.trim()) return invoices;
        const s = search.toLowerCase();
        return invoices.filter((inv) => {
            const cust = customers.find((c) => c.id === inv.customer_id);
            const name = cust?.name?.toLowerCase() ?? "";
            return (
                inv.invoice_number?.toLowerCase().includes(s) ||
                name.includes(s)
            );
        });
    }, [invoices, customers, search]);

    const createInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload: Record<string, string> = {
                customer_id: newInvoice.customer_id,
                invoice_date: newInvoice.invoice_date,
                total_amount: newInvoice.total_amount,
                status: newInvoice.status,
                invoice_type: newInvoice.invoice_type || "TAX_INVOICE",
            };
            if (newInvoice.invoice_number.trim()) payload.invoice_number = newInvoice.invoice_number.trim();
            if (newInvoice.so_id) payload.so_id = newInvoice.so_id;
            if (newInvoice.due_date) payload.due_date = newInvoice.due_date;
            if (newInvoice.place_of_supply_state) payload.place_of_supply_state = newInvoice.place_of_supply_state;
            if (newInvoice.subtotal) payload.subtotal = newInvoice.subtotal;
            if (newInvoice.cgst_total) payload.cgst_total = newInvoice.cgst_total;
            if (newInvoice.sgst_total) payload.sgst_total = newInvoice.sgst_total;
            if (newInvoice.igst_total) payload.igst_total = newInvoice.igst_total;

            await api.post("/sales/invoices", payload);
            setShowModal(false);
            setNewInvoice({
                customer_id: "",
                so_id: "",
                invoice_number: "",
                invoice_date: new Date().toISOString().slice(0, 10),
                due_date: "",
                total_amount: "",
                status: "DRAFT",
                place_of_supply_state: "",
                invoice_type: "TAX_INVOICE",
                subtotal: "",
                cgst_total: "",
                sgst_total: "",
                igst_total: "",
            });
            fetchData();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to create invoice";
            alert(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const recordPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!detailId) return;
        setSubmitting(true);
        try {
            await api.post(`/sales/invoices/${detailId}/payments`, {
                amount: paymentForm.amount,
                payment_date: paymentForm.payment_date,
                payment_method: paymentForm.payment_method,
                reference_number: paymentForm.reference_number || undefined,
            });
            setShowPaymentModal(false);
            setPaymentForm({
                amount: detail ? String(detail.balance_due) : "",
                payment_date: new Date().toISOString().slice(0, 10),
                payment_method: "BANK_TRANSFER",
                reference_number: "",
            });
            fetchDetail(detailId);
            fetchData();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to record payment";
            alert(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const updateStatus = async (status: string) => {
        if (!detailId) return;
        setShowStatusDropdown(false);
        try {
            await api.patch(`/sales/invoices/${detailId}/status`, { status });
            fetchDetail(detailId);
            fetchData();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to update status";
            alert(msg);
        }
    };

    const handlePrint = () => {
        const printContent = document.getElementById("invoice-print-area");
        if (!printContent) return;
        const prevTitle = document.title;
        document.title = `Invoice ${detail?.invoice?.invoice_number ?? ""}`;
        const win = window.open("", "_blank");
        if (!win) return;
        win.document.write(`
          <!DOCTYPE html><html><head><title>Invoice</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 24px; color: #111; max-width: 800px; margin: 0 auto; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
            th { background: #f5f5f5; }
            .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
            .amount { font-weight: 600; }
          </style></head><body>
          ${printContent.innerHTML}
          </body></html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => {
            win.print();
            win.close();
            document.title = prevTitle;
        }, 300);
    };

    const getCustomerName = (id: string) => {
        const c = customers.find((x) => x.id === id);
        return c ? c.name : "—";
    };

    const getSONumber = (id: string | null) => {
        if (!id) return "—";
        const so = salesOrders.find((x) => x.id === id);
        return so ? so.so_number : "—";
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "DRAFT":
                return "bg-zinc-500/10 text-muted-foreground border-zinc-500/20";
            case "UNPAID":
                return "bg-amber-500/10 text-amber-400 border-amber-500/20";
            case "PARTIAL":
                return "bg-blue-500/10 text-blue-400 border-blue-500/20";
            case "PAID":
                return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            case "OVERDUE":
                return "bg-red-500/10 text-red-400 border-red-500/20";
            case "CANCELLED":
                return "bg-zinc-500/10 text-muted-foreground border-zinc-500/20";
            default:
                return "bg-zinc-500/10 text-muted-foreground border-zinc-500/20";
        }
    };

    const formatDate = (d: string | null) =>
        d ? new Date(d).toLocaleDateString() : "—";
    const formatMoney = (n: number | string) =>
        `₹${parseFloat(String(n)).toLocaleString("en-IN")}`;

    const canRecordPayment = detail && detail.invoice.status !== "PAID" && detail.invoice.status !== "CANCELLED" && detail.balance_due > 0;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center bg-card/80 border border-border p-6 rounded-2xl shadow-xl">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                        <FileText className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
                            Invoices Ledger
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Create and manage customer invoices, payments, and status.
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => setShowModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                >
                    <Plus className="w-4 h-4" />
                    New Invoice
                </button>
            </div>

            <div className="bg-card/60 backdrop-blur-md border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-border flex gap-4 bg-card">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by invoice number or customer..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-sm text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-muted/30 text-muted-foreground font-medium">
                            <tr>
                                <th className="px-6 py-4">Invoice #</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Sales Order</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Due Date</th>
                                <th className="px-6 py-4">Amount</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-foreground">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                                        Loading invoices...
                                    </td>
                                </tr>
                            ) : filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                                        No invoices found. Create one to get started.
                                    </td>
                                </tr>
                            ) : (
                                filteredInvoices.map((inv) => (
                                    <tr
                                        key={inv.id}
                                        className="hover:bg-muted/50 transition-colors cursor-pointer"
                                        onClick={() => setDetailId(inv.id)}
                                    >
                                        <td className="px-6 py-4 font-medium text-foreground flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-muted-foreground" />
                                            {inv.invoice_number}
                                        </td>
                                        <td className="px-6 py-4">{getCustomerName(inv.customer_id)}</td>
                                        <td className="px-6 py-4 font-mono text-muted-foreground">{getSONumber(inv.so_id)}</td>
                                        <td className="px-6 py-4">{formatDate(inv.invoice_date)}</td>
                                        <td className="px-6 py-4">{formatDate(inv.due_date)}</td>
                                        <td className="px-6 py-4 font-mono">{formatMoney(inv.total_amount || "0")}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${getStatusColor(inv.status)}`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                                                onClick={() => setDetailId(inv.id)}
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail drawer */}
            {detailId && (
                <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-card border-l border-border shadow-2xl z-50 flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-border flex justify-between items-center shrink-0">
                        <h2 className="text-lg font-semibold text-foreground">Invoice details</h2>
                        <div className="flex items-center gap-2">
                            {detail && (
                                <>
                                    <button
                                        onClick={handlePrint}
                                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                                        title="Print"
                                    >
                                        <Printer className="w-5 h-5" />
                                    </button>
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                                            className="px-3 py-1.5 rounded-lg border text-sm font-medium border-border text-foreground hover:bg-muted/50"
                                        >
                                            {detail.invoice.status} ▾
                                        </button>
                                        {showStatusDropdown && (
                                            <div className="absolute right-0 top-full mt-1 py-1 bg-[#1a1a1c] border border-border rounded-xl shadow-xl z-10 min-w-[140px]">
                                                {["OVERDUE", "CANCELLED", "UNPAID", "DRAFT"].map((s) => (
                                                    <button
                                                        key={s}
                                                        onClick={() => updateStatus(s)}
                                                        className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted"
                                                    >
                                                        Mark as {s}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                            <button
                                onClick={() => { setDetailId(null); setShowPaymentModal(false); setShowStatusDropdown(false); }}
                                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-6">
                        {detailLoading ? (
                            <div className="text-muted-foreground text-center py-12">Loading...</div>
                        ) : detail ? (
                            <>
                                <div id="invoice-print-area" className="space-y-6">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-2xl font-bold text-foreground">{detail.invoice.invoice_number}</p>
                                            <p className="text-muted-foreground mt-1">{getCustomerName(detail.invoice.customer_id)}</p>
                                            {detail.invoice.so_id && (
                                                <p className="text-muted-foreground text-sm mt-0.5">SO: {getSONumber(detail.invoice.so_id)}</p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${getStatusColor(detail.invoice.status)}`}>
                                                {detail.invoice.status}
                                            </span>
                                            {detail.overdue && (
                                                <span className="ml-2 px-2.5 py-1 text-xs font-semibold rounded-md border bg-red-500/10 text-red-400 border-red-500/20">
                                                    OVERDUE
                                                </span>
                                            )}
                                            <p className="text-muted-foreground text-sm mt-2">Date: {formatDate(detail.invoice.invoice_date)}</p>
                                            {detail.invoice.due_date && (
                                                <p className="text-muted-foreground text-sm">Due: {formatDate(detail.invoice.due_date)}</p>
                                            )}
                                        </div>
                                    </div>

                                    {detail.line_items && detail.line_items.length > 0 && (
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-muted-foreground border-b border-border">
                                                    <th className="text-left py-2">Description</th>
                                                    {detail.line_items.some((li) => li.hsn_sac) && <th className="text-left py-2">HSN/SAC</th>}
                                                    <th className="text-right py-2">Qty</th>
                                                    <th className="text-right py-2">Unit</th>
                                                    <th className="text-right py-2">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-foreground">
                                                {detail.line_items.map((li) => (
                                                    <tr key={li.id} className="border-b border-border">
                                                        <td className="py-2">{li.description}</td>
                                                        {detail.line_items.some((l) => l.hsn_sac) && <td className="py-2 font-mono text-xs">{li.hsn_sac ?? "—"}</td>}
                                                        <td className="text-right py-2">{li.quantity}</td>
                                                        <td className="text-right py-2">{formatMoney(li.unit_price)}</td>
                                                        <td className="text-right py-2">{formatMoney(li.total_line)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}

                                    <div className="flex justify-end">
                                        <div className="text-right space-y-1">
                                            {(detail.invoice.cgst_total != null || detail.invoice.igst_total != null) && (
                                                <>
                                                    {detail.invoice.subtotal != null && <p className="text-muted-foreground">Subtotal: <span className="text-foreground">{formatMoney(detail.invoice.subtotal ?? "0")}</span></p>}
                                                    {Number(detail.invoice.cgst_total) > 0 && <p className="text-muted-foreground">CGST: <span className="text-foreground">{formatMoney(detail.invoice.cgst_total ?? "0")}</span></p>}
                                                    {Number(detail.invoice.sgst_total) > 0 && <p className="text-muted-foreground">SGST: <span className="text-foreground">{formatMoney(detail.invoice.sgst_total ?? "0")}</span></p>}
                                                    {Number(detail.invoice.igst_total) > 0 && <p className="text-muted-foreground">IGST: <span className="text-foreground">{formatMoney(detail.invoice.igst_total ?? "0")}</span></p>}
                                                </>
                                            )}
                                            <p className="text-muted-foreground">Total: <span className="text-foreground font-semibold">{formatMoney(detail.invoice.total_amount)}</span></p>
                                            <p className="text-muted-foreground">Paid: <span className="text-emerald-400">{formatMoney(detail.paid_total)}</span></p>
                                            <p className="text-muted-foreground">Balance due: <span className="text-amber-400 font-semibold">{formatMoney(detail.balance_due)}</span></p>
                                        </div>
                                    </div>

                                    {detail.payments && detail.payments.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium text-muted-foreground mb-2">Payments</h3>
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-muted-foreground border-b border-border">
                                                        <th className="text-left py-2">Date</th>
                                                        <th className="text-left py-2">Method</th>
                                                        <th className="text-right py-2">Amount</th>
                                                        <th className="text-left py-2">Reference</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-foreground">
                                                    {detail.payments.map((p) => (
                                                        <tr key={p.id} className="border-b border-border">
                                                            <td className="py-2">{formatDate(p.payment_date)}</td>
                                                            <td className="py-2">{p.payment_method ?? "—"}</td>
                                                            <td className="text-right py-2">{formatMoney(p.amount)}</td>
                                                            <td className="py-2">{p.reference_number ?? "—"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {canRecordPayment && (
                                    <div className="mt-6 pt-6 border-t border-border">
                                        <button
                                            onClick={() => {
                                                setPaymentForm((prev) => ({ ...prev, amount: String(detail.balance_due) }));
                                                setShowPaymentModal(true);
                                            }}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl"
                                        >
                                            <DollarSign className="w-4 h-4" />
                                            Record payment
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-muted-foreground text-center py-12">Invoice not found.</div>
                        )}
                    </div>
                </div>
            )}

            {/* Create invoice modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-lg font-medium text-foreground">Create Invoice</h3>
                            <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">&times;</button>
                        </div>
                        <form onSubmit={createInvoice} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Customer</label>
                                <select
                                    required
                                    value={newInvoice.customer_id}
                                    onChange={(e) => setNewInvoice({ ...newInvoice, customer_id: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                                >
                                    <option value="" disabled className="text-muted-foreground">Select Customer</option>
                                    {customers.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Sales Order (optional)</label>
                                <select
                                    value={newInvoice.so_id}
                                    onChange={(e) => setNewInvoice({ ...newInvoice, so_id: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                                >
                                    <option value="" className="text-muted-foreground">None</option>
                                    {salesOrders.filter((so) => so.customer_id === newInvoice.customer_id).map((so) => (
                                        <option key={so.id} value={so.id}>{so.so_number} — {formatMoney(so.total_amount || "0")}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Invoice number (optional)</label>
                                    <input
                                        type="text"
                                        value={newInvoice.invoice_number}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, invoice_number: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground font-mono"
                                        placeholder={nextNumber ?? "Auto-generated if blank"}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                                    <select
                                        value={newInvoice.status}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, status: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                                    >
                                        <option value="DRAFT">DRAFT</option>
                                        <option value="UNPAID">UNPAID</option>
                                        <option value="PARTIAL">PARTIAL</option>
                                        <option value="PAID">PAID</option>
                                        <option value="OVERDUE">OVERDUE</option>
                                        <option value="CANCELLED">CANCELLED</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Invoice date</label>
                                    <input
                                        type="date"
                                        required
                                        value={newInvoice.invoice_date}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, invoice_date: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground [color-scheme:dark]"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Due date (optional)</label>
                                    <input
                                        type="date"
                                        value={newInvoice.due_date}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground [color-scheme:dark]"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Place of supply (state code)</label>
                                    <input
                                        type="text"
                                        value={newInvoice.place_of_supply_state}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, place_of_supply_state: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                                        placeholder="e.g. 23"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Invoice type</label>
                                    <select
                                        value={newInvoice.invoice_type}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, invoice_type: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                                    >
                                        <option value="TAX_INVOICE">Tax Invoice</option>
                                        <option value="BILL_OF_SUPPLY">Bill of Supply</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Total amount (₹)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={newInvoice.total_amount}
                                    onChange={(e) => setNewInvoice({ ...newInvoice, total_amount: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-lg transition-colors">Create invoice</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Record payment modal */}
            {showPaymentModal && detailId && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-lg font-medium text-foreground">Record payment</h3>
                            <button onClick={() => setShowPaymentModal(false)} className="text-muted-foreground hover:text-foreground">&times;</button>
                        </div>
                        <form onSubmit={recordPayment} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Amount (₹)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={paymentForm.amount}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Payment date</label>
                                <input
                                    type="date"
                                    required
                                    value={paymentForm.payment_date}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground [color-scheme:dark]"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Method</label>
                                <select
                                    value={paymentForm.payment_method}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                                >
                                    <option value="CASH">CASH</option>
                                    <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                                    <option value="CARD">CARD</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Reference (optional)</label>
                                <input
                                    type="text"
                                    value={paymentForm.reference_number}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                                    placeholder="Cheque / transaction ID"
                                />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowPaymentModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-lg transition-colors">Record payment</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
