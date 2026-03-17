"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Plus, Pencil, Trash2, Building2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

interface Plant {
    id: string;
    code: string;
    name: string;
    company_code_id: string | null;
    time_zone: string | null;
    created_at: string;
    updated_at: string;
}

interface CompanyCode {
    id: string;
    code: string;
    name: string;
}

interface ListResponse {
    data: Plant[];
    total: number;
}

export default function PlantsPage() {
    const [list, setList] = useState<Plant[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [offset, setOffset] = useState(0);
    const [companyCodes, setCompanyCodes] = useState<CompanyCode[]>([]);

    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Plant | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Plant | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [form, setForm] = useState({ code: "", name: "", company_code_id: "", time_zone: "Asia/Kolkata" });

    const fetchList = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await api.get<ListResponse>("/organization/plants", {
                params: { limit: PAGE_SIZE, offset },
            });
            setList(res.data?.data ?? []);
            setTotal(res.data?.total ?? 0);
        } catch (err: unknown) {
            setError(err && typeof err === "object" && "response" in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed to load"
                : "Failed to load");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchList();
    }, [offset]);

    useEffect(() => {
        api.get<{ data: CompanyCode[] }>("/organization/company-codes", { params: { limit: 500 } })
            .then((r) => setCompanyCodes(r.data?.data ?? []))
            .catch(() => {});
    }, []);

    const openCreate = () => {
        setEditing(null);
        setForm({ code: "", name: "", company_code_id: "", time_zone: "Asia/Kolkata" });
        setShowModal(true);
    };

    const openEdit = (row: Plant) => {
        setEditing(row);
        setForm({
            code: row.code,
            name: row.name,
            company_code_id: row.company_code_id ?? "",
            time_zone: row.time_zone ?? "Asia/Kolkata",
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.code.trim() || !form.name.trim()) return;
        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                company_code_id: form.company_code_id || null,
                time_zone: form.time_zone || null,
            };
            if (editing) {
                await api.put(`/organization/plants/${editing.id}`, payload);
            } else {
                await api.post("/organization/plants", { code: form.code.trim(), ...payload });
            }
            setShowModal(false);
            fetchList();
        } catch (err: unknown) {
            const msg = err && typeof err === "object" && "response" in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed to save"
                : "Failed to save";
            alert(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/organization/plants/${deleteTarget.id}`);
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
    const ccMap = Object.fromEntries(companyCodes.map((c) => [c.id, c]));

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Plants</h1>
                    <p className="text-muted-foreground mt-1">Manufacturing sites and storage locations.</p>
                </div>
                <button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium">
                    <Plus className="w-4 h-4" /> Add Plant
                </button>
            </div>

            <div className="bg-card/80 border border-border rounded-2xl shadow-xl overflow-hidden">
                {loading && !list.length ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : error ? (
                    <div className="p-8 text-center text-destructive">{error}</div>
                ) : list.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground">
                        <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No plants yet. Create one to get started.</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="text-left p-4 font-medium text-foreground">Code</th>
                                        <th className="text-left p-4 font-medium text-foreground">Name</th>
                                        <th className="text-left p-4 font-medium text-foreground">Company Code</th>
                                        <th className="text-left p-4 font-medium text-foreground">Time zone</th>
                                        <th className="w-24 p-4" aria-label="Actions" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {list.map((row) => (
                                        <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20">
                                            <td className="p-4 font-medium">{row.code}</td>
                                            <td className="p-4">{row.name}</td>
                                            <td className="p-4">{row.company_code_id ? (ccMap[row.company_code_id]?.code ?? row.company_code_id) : "—"}</td>
                                            <td className="p-4">{row.time_zone ?? "—"}</td>
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
                        <h2 className="text-lg font-semibold text-foreground mb-4">{editing ? "Edit Plant" : "New Plant"}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Code</label>
                                <input type="text" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} disabled={!!editing} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground disabled:opacity-60" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Company Code</label>
                                <select value={form.company_code_id} onChange={(e) => setForm((f) => ({ ...f, company_code_id: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground">
                                    <option value="">— None —</option>
                                    {companyCodes.map((c) => (
                                        <option key={c.id} value={c.id}>{c.code} – {c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Time zone</label>
                                <input type="text" value={form.time_zone} onChange={(e) => setForm((f) => ({ ...f, time_zone: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground" />
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
                        <p className="text-foreground font-medium">Delete plant &quot;{deleteTarget.name}&quot;?</p>
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
