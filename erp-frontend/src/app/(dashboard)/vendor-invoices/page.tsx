"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { FileText, Loader2, Pencil, X } from "lucide-react";

interface VendorInvoice {
    id: string;
    vendor_id: string;
    po_id?: string | null;
    invoice_number: string;
    invoice_date: string;
    due_date?: string | null;
    total_amount: string;
    status: string;
    created_at: string;
    tds_section?: string | null;
    tds_rate?: string | number | null;
    tds_amount?: string | null;
    tds_paid_at?: string | null;
    challan_number?: string | null;
}

export default function VendorInvoicesPage() {
    const [list, setList] = useState<VendorInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [tdsModal, setTdsModal] = useState<VendorInvoice | null>(null);
    const [tdsForm, setTdsForm] = useState({ tds_section: "", tds_rate: "", tds_amount: "", tds_paid_at: "", challan_number: "" });
    const [savingTds, setSavingTds] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await api.get("/purchase/vendor-invoices");
            setList(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
            setList([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openTdsModal = (inv: VendorInvoice) => {
        setTdsModal(inv);
        setTdsForm({
            tds_section: inv.tds_section ?? "",
            tds_rate: inv.tds_rate != null ? String(inv.tds_rate) : "",
            tds_amount: inv.tds_amount ?? "",
            tds_paid_at: inv.tds_paid_at ? inv.tds_paid_at.slice(0, 16) : "",
            challan_number: inv.challan_number ?? "",
        });
    };

    const saveTds = async () => {
        if (!tdsModal) return;
        setSavingTds(true);
        try {
            await api.patch(`/purchase/vendor-invoices/${tdsModal.id}/tds`, {
                tds_section: tdsForm.tds_section || undefined,
                tds_rate: tdsForm.tds_rate ? tdsForm.tds_rate : undefined,
                tds_amount: tdsForm.tds_amount ? tdsForm.tds_amount : undefined,
                tds_paid_at: tdsForm.tds_paid_at ? new Date(tdsForm.tds_paid_at).toISOString() : undefined,
                challan_number: tdsForm.challan_number || undefined,
            });
            setTdsModal(null);
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Failed to update TDS");
        } finally {
            setSavingTds(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                        <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Vendor Invoices</h1>
                        <p className="text-sm text-muted-foreground">Bills from vendors; link to POs, TDS (India) and payment status.</p>
                    </div>
                </div>
            </div>

            <div className="bg-card/80 border border-border rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : list.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm">No vendor invoices yet.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-left text-muted-foreground">
                                    <th className="px-6 py-4 font-medium">Invoice #</th>
                                    <th className="px-6 py-4 font-medium">Date</th>
                                    <th className="px-6 py-4 font-medium">Amount</th>
                                    <th className="px-6 py-4 font-medium">TDS</th>
                                    <th className="px-6 py-4 font-medium">Status</th>
                                    <th className="px-6 py-4 font-medium">Created</th>
                                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map((inv) => (
                                    <tr key={inv.id} className="border-b border-border hover:bg-muted/50">
                                        <td className="px-6 py-4 text-foreground font-mono">{inv.invoice_number}</td>
                                        <td className="px-6 py-4 text-foreground">{inv.invoice_date || "—"}</td>
                                        <td className="px-6 py-4 text-foreground">{inv.total_amount ?? "—"}</td>
                                        <td className="px-6 py-4 text-foreground">
                                            {inv.tds_section || inv.tds_amount ? (
                                                <span className="text-xs">
                                                    {inv.tds_section && <span className="font-mono">{inv.tds_section}</span>}
                                                    {inv.tds_amount && <span className="text-muted-foreground"> ₹{inv.tds_amount}</span>}
                                                </span>
                                            ) : "—"}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs ${inv.status === "PAID" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">{inv.created_at ? new Date(inv.created_at).toLocaleString() : "—"}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() => openTdsModal(inv)}
                                                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted inline-flex items-center gap-1 text-xs"
                                                title="Edit TDS"
                                            >
                                                <Pencil className="w-3.5 h-3.5" /> TDS
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {tdsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-lg font-medium text-foreground">TDS (India) — {tdsModal.invoice_number}</h3>
                            <button type="button" onClick={() => setTdsModal(null)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">TDS Section</label>
                                    <input
                                        type="text"
                                        value={tdsForm.tds_section}
                                        onChange={(e) => setTdsForm({ ...tdsForm, tds_section: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                        placeholder="e.g. 194C"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">TDS Rate %</label>
                                    <input
                                        type="text"
                                        value={tdsForm.tds_rate}
                                        onChange={(e) => setTdsForm({ ...tdsForm, tds_rate: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                        placeholder="e.g. 2"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">TDS Amount</label>
                                <input
                                    type="text"
                                    value={tdsForm.tds_amount}
                                    onChange={(e) => setTdsForm({ ...tdsForm, tds_amount: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">TDS Paid At (date-time)</label>
                                <input
                                    type="datetime-local"
                                    value={tdsForm.tds_paid_at}
                                    onChange={(e) => setTdsForm({ ...tdsForm, tds_paid_at: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Challan Number</label>
                                <input
                                    type="text"
                                    value={tdsForm.challan_number}
                                    onChange={(e) => setTdsForm({ ...tdsForm, challan_number: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                    placeholder="Challan number"
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end gap-2">
                            <button type="button" onClick={() => setTdsModal(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted/50">
                                Cancel
                            </button>
                            <button type="button" onClick={saveTds} disabled={savingTds} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-70 text-white text-sm font-medium rounded-xl flex items-center gap-2">
                                {savingTds && <Loader2 className="w-4 h-4 animate-spin" />}
                                Save TDS
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
