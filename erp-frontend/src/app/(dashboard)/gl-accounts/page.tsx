"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Plus, Pencil, Trash2, Banknote, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

interface GLAccount {
    id: string;
    chart_of_accounts_id: string;
    account_number: string;
    account_type: string;
    group_code: string | null;
    created_at: string;
    updated_at: string;
}

interface ChartOfAccount {
    id: string;
    code: string;
    name: string;
}

interface ListResponse {
    data: GLAccount[];
    total: number;
}

export default function GLAccountsPage() {
    const [list, setList] = useState<GLAccount[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [offset, setOffset] = useState(0);
    const [chartFilter, setChartFilter] = useState<string>("");
    const [charts, setCharts] = useState<ChartOfAccount[]>([]);

    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<GLAccount | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<GLAccount | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [form, setForm] = useState({ chart_of_accounts_id: "", account_number: "", account_type: "P", group_code: "" });

    const fetchList = async () => {
        try {
            setLoading(true);
            setError(null);
            const params: { limit: number; offset: number; chart_of_accounts_id?: string } = { limit: PAGE_SIZE, offset };
            if (chartFilter) params.chart_of_accounts_id = chartFilter;
            const res = await api.get<ListResponse>("/finance/gl-accounts", { params });
            setList(res.data?.data ?? []);
            setTotal(res.data?.total ?? 0);
        } catch (err: unknown) {
            setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to load");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchList(); }, [offset, chartFilter]);

    useEffect(() => {
        api.get<{ data: ChartOfAccount[] }>("/finance/chart-of-accounts", { params: { limit: 500 } }).then((r) => setCharts(r.data?.data ?? [])).catch(() => {});
    }, []);

    const openCreate = () => {
        setEditing(null);
        setForm({ chart_of_accounts_id: chartFilter || (charts[0]?.id ?? ""), account_number: "", account_type: "P", group_code: "" });
        setShowModal(true);
    };
    const openEdit = (row: GLAccount) => {
        setEditing(row);
        setForm({
            chart_of_accounts_id: row.chart_of_accounts_id,
            account_number: row.account_number,
            account_type: row.account_type,
            group_code: row.group_code ?? "",
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.chart_of_accounts_id || !form.account_number.trim()) return;
        setSaving(true);
        try {
            if (editing) {
                await api.put(`/finance/gl-accounts/${editing.id}`, { account_type: form.account_type, group_code: form.group_code || null });
            } else {
                await api.post("/finance/gl-accounts", {
                    chart_of_accounts_id: form.chart_of_accounts_id,
                    account_number: form.account_number.trim(),
                    account_type: form.account_type,
                    group_code: form.group_code.trim() || null,
                });
            }
            setShowModal(false);
            fetchList();
        } catch (err: unknown) {
            alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/finance/gl-accounts/${deleteTarget.id}`);
            setDeleteTarget(null);
            fetchList();
        } catch (err: unknown) {
            alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to delete");
        } finally {
            setDeleting(false);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">G/L Accounts</h1>
                    <p className="text-muted-foreground mt-1">General ledger account master.</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={chartFilter}
                        onChange={(e) => { setChartFilter(e.target.value); setOffset(0); }}
                        className="px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm"
                    >
                        <option value="">All charts</option>
                        {charts.map((c) => (
                            <option key={c.id} value={c.id}>{c.code} – {c.name}</option>
                        ))}
                    </select>
                    <button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium"><Plus className="w-4 h-4" /> Add G/L Account</button>
                </div>
            </div>

            <div className="bg-card/80 border border-border rounded-2xl shadow-xl overflow-hidden">
                {loading && !list.length ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : error ? (
                    <div className="p-8 text-center text-destructive">{error}</div>
                ) : list.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground"><Banknote className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>No G/L accounts yet. Select a chart or create one.</p></div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="text-left p-4 font-medium text-foreground">Account number</th>
                                        <th className="text-left p-4 font-medium text-foreground">Type</th>
                                        <th className="text-left p-4 font-medium text-foreground">Group</th>
                                        <th className="w-24 p-4" aria-label="Actions" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {list.map((row) => (
                                        <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20">
                                            <td className="p-4 font-medium">{row.account_number}</td>
                                            <td className="p-4">{row.account_type === "P" ? "P&L" : "Balance sheet"}</td>
                                            <td className="p-4">{row.group_code ?? "—"}</td>
                                            <td className="p-4 flex items-center gap-2">
                                                <button type="button" onClick={() => openEdit(row)} className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                                                <button type="button" onClick={() => setDeleteTarget(row)} className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                                <span className="text-sm text-muted-foreground">{total} total</span>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))} disabled={offset === 0} className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
                                    <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                                    <button type="button" onClick={() => setOffset((o) => o + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total} className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
                    <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h2 className="text-lg font-semibold text-foreground mb-4">{editing ? "Edit G/L Account" : "New G/L Account"}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Chart of accounts</label>
                                <select value={form.chart_of_accounts_id} onChange={(e) => setForm((f) => ({ ...f, chart_of_accounts_id: e.target.value }))} disabled={!!editing} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground disabled:opacity-60" required>
                                    {charts.map((c) => (
                                        <option key={c.id} value={c.id}>{c.code} – {c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Account number</label>
                                <input type="text" value={form.account_number} onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))} disabled={!!editing} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground disabled:opacity-60" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Type</label>
                                <select value={form.account_type} onChange={(e) => setForm((f) => ({ ...f, account_type: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground">
                                    <option value="P">P&L</option>
                                    <option value="B">Balance sheet</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Group code</label>
                                <input type="text" value={form.group_code} onChange={(e) => setForm((f) => ({ ...f, group_code: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground" />
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl border border-border hover:bg-muted">Cancel</button>
                                <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70 flex items-center gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}{editing ? "Update" : "Create"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
                    <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <p className="text-foreground font-medium">Delete G/L account &quot;{deleteTarget.account_number}&quot;?</p>
                        <div className="flex justify-end gap-2 mt-6">
                            <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl border border-border hover:bg-muted">Cancel</button>
                            <button type="button" onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-70 flex items-center gap-2">{deleting && <Loader2 className="w-4 h-4 animate-spin" />}Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
