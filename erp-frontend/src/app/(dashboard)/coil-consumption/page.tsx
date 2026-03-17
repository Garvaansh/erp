"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import {
    Layers,
    Plus,
    Calendar,
    Package,
    Recycle,
    ArrowRight,
    CheckCircle2,
    Loader2,
    FileSpreadsheet,
} from "lucide-react";
import { ExcelUpload } from "@/components/ExcelUpload";

interface Product {
    id: string;
    name: string;
    sku: string;
    uom?: string;
    product_type?: string | null;
}

interface CoilLogRow {
    id: string;
    product_id: string;
    product_name: string;
    product_sku: string;
    product_type: string | null;
    operation_date: string;
    starting_kg: string;
    scrap_kg: string;
    shortlength_kg: string;
    used_kg: string;
    remaining_kg: string;
    coil_ended: boolean;
    notes: string | null;
    created_at: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function CoilConsumptionPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [logs, setLogs] = useState<CoilLogRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState("");
    const [lastRemaining, setLastRemaining] = useState<string | null>(null);
    const [form, setForm] = useState({
        operation_date: today(),
        product_id: "",
        starting_kg: "",
        scrap_kg: "0",
        shortlength_kg: "0",
        used_kg: "",
        remaining_kg: "",
        coil_ended: false,
        notes: "",
    });
    const [showExcelImport, setShowExcelImport] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (form.product_id) {
            api.get(`/reva/coil-consumption/product/${form.product_id}/last-remaining`)
                .then((r) => setLastRemaining(r.data?.remaining_kg != null ? String(r.data.remaining_kg) : null))
                .catch(() => setLastRemaining(null));
        } else {
            setLastRemaining(null);
        }
    }, [form.product_id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [prodRes, logRes] = await Promise.all([
                api.get("/inventory/products"),
                api.get("/reva/coil-consumption?limit=100"),
            ]);
            setProducts(prodRes.data || []);
            setLogs(logRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const openForm = (productId?: string) => {
        setForm({
            operation_date: today(),
            product_id: productId || "",
            starting_kg: lastRemaining || "",
            scrap_kg: "0",
            shortlength_kg: "0",
            used_kg: "",
            remaining_kg: "",
            coil_ended: false,
            notes: "",
        });
        setSelectedProductId(productId || "");
        setShowForm(true);
    };

    const computeRemaining = () => {
        const start = parseFloat(form.starting_kg) || 0;
        const used = parseFloat(form.used_kg) || 0;
        const scrap = parseFloat(form.scrap_kg) || 0;
        const short = parseFloat(form.shortlength_kg) || 0;
        const rem = start - used - scrap - short;
        setForm((f) => ({ ...f, remaining_kg: rem >= 0 ? rem.toFixed(2) : "" }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const start = parseFloat(form.starting_kg) || 0;
        const used = parseFloat(form.used_kg) || 0;
        const scrap = parseFloat(form.scrap_kg) || 0;
        const short = parseFloat(form.shortlength_kg) || 0;
        const remaining = start - used - scrap - short;
        if (!form.product_id || remaining < 0) {
            alert("Select a coil type and ensure remaining kg is non-negative.");
            return;
        }
        setSubmitting(true);
        try {
            await api.post("/reva/coil-consumption", {
                product_id: form.product_id,
                operation_date: form.operation_date,
                starting_kg: form.starting_kg,
                scrap_kg: form.scrap_kg,
                shortlength_kg: form.shortlength_kg,
                used_kg: form.used_kg,
                remaining_kg: remaining.toFixed(2),
                coil_ended: form.coil_ended,
                notes: form.notes || null,
            });
            setShowForm(false);
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Failed to save coil consumption log.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center bg-card/80 border border-border p-6 rounded-2xl shadow-xl">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
                        <Layers className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
                            Coil Consumption (REVA-26)
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Log daily coil use, scrap, shortlength and remaining stock.
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setShowExcelImport(!showExcelImport)}
                        className="bg-muted hover:bg-muted text-foreground text-sm font-medium py-2.5 px-5 rounded-xl flex items-center gap-2 border border-border"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Import Excel
                    </button>
                    <button
                        onClick={() => openForm()}
                        className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        New Entry
                    </button>
                </div>
            </div>

            {showExcelImport && (
                <ExcelUpload<{
                    product_id: string;
                    operation_date: string;
                    starting_kg: string;
                    scrap_kg: string;
                    shortlength_kg: string;
                    used_kg: string;
                    remaining_kg: string;
                    coil_ended: boolean;
                    notes?: string | null;
                }>
                    endpoint="/reva/coil-consumption/bulk"
                    templateFilename="coil_consumption_template.xlsx"
                    templateHeaders={["Date (YYYY-MM-DD)", "Coil SKU", "Starting (kg)", "Scrap (kg)", "Shortlength (kg)", "Used (kg)", "Remaining (kg)", "Coil Ended (Y/N)", "Notes"]}
                    sampleRow={["2025-03-15", "COIL-30MM", 100, 2, 1, 50, 47, "N", "Daily log"]}
                    columnsHelp={[
                        { header: "Date (YYYY-MM-DD)", required: true, sample: "2025-03-15" },
                        { header: "Coil SKU", required: true, sample: "COIL-30MM" },
                        { header: "Starting (kg)", required: true, sample: 100 },
                        { header: "Scrap (kg)", required: false, sample: 2 },
                        { header: "Shortlength (kg)", required: false, sample: 1 },
                        { header: "Used (kg)", required: true, sample: 50 },
                        { header: "Remaining (kg)", required: false, sample: 47 },
                        { header: "Coil Ended (Y/N)", required: false, sample: "N" },
                        { header: "Notes", required: false, sample: "Daily log" },
                    ]}
                    mapRow={(row) => {
                        const sku = String(row["Coil SKU"] ?? row["coil_sku"] ?? "").trim();
                        const product = products.find((p) => p.sku === sku);
                        if (!product || !sku) return null;
                        const opDate = String(row["Date (YYYY-MM-DD)"] ?? row["operation_date"] ?? row["Date"] ?? today()).trim();
                        const start = String(row["Starting (kg)"] ?? row["starting_kg"] ?? "0").trim() || "0";
                        const scrap = String(row["Scrap (kg)"] ?? row["scrap_kg"] ?? "0").trim() || "0";
                        const short = String(row["Shortlength (kg)"] ?? row["shortlength_kg"] ?? "0").trim() || "0";
                        const used = String(row["Used (kg)"] ?? row["used_kg"] ?? "0").trim() || "0";
                        const rem = String(row["Remaining (kg)"] ?? row["remaining_kg"] ?? "").trim();
                        const coilEnded = /^(1|y|yes|true)$/i.test(String(row["Coil Ended (Y/N)"] ?? row["coil_ended"] ?? "").trim());
                        const startNum = parseFloat(start) || 0;
                        const usedNum = parseFloat(used) || 0;
                        const scrapNum = parseFloat(scrap) || 0;
                        const shortNum = parseFloat(short) || 0;
                        const remainingKg = rem !== "" ? rem : (startNum - usedNum - scrapNum - shortNum).toFixed(2);
                        return {
                            product_id: product.id,
                            operation_date: opDate || today(),
                            starting_kg: start,
                            scrap_kg: scrap,
                            shortlength_kg: short,
                            used_kg: used,
                            remaining_kg: remainingKg,
                            coil_ended: coilEnded,
                            notes: (v => (v ? String(v).trim() : null))(row["Notes"] ?? row["notes"]),
                        };
                    }}
                    onSuccess={() => fetchData()}
                    onClose={() => setShowExcelImport(false)}
                    title="Bulk import coil consumption"
                />
            )}

            {showForm && (
                <div className="bg-card/80 border border-border p-6 rounded-2xl shadow-xl">
                    <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5 text-amber-400" />
                        Log Coil Consumption
                    </h2>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                                <Calendar className="w-3.5 h-3.5" /> Date
                            </label>
                            <input
                                type="date"
                                required
                                value={form.operation_date}
                                onChange={(e) => setForm({ ...form, operation_date: e.target.value })}
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                                <Package className="w-3.5 h-3.5" /> Coil Type *
                            </label>
                            <select
                                required
                                value={form.product_id}
                                onChange={(e) => {
                                    setForm({ ...form, product_id: e.target.value });
                                    setSelectedProductId(e.target.value);
                                }}
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                            >
                                <option value="">Select coil...</option>
                                {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} {p.product_type ? `(${p.product_type})` : ""} – {p.sku}
                                    </option>
                                ))}
                            </select>
                            {lastRemaining != null && (
                                <p className="text-xs text-amber-400/90 mt-1">
                                    Last remaining: {lastRemaining} kg (use as starting if same coil)
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1">Starting (kg) *</label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                value={form.starting_kg}
                                onChange={(e) => setForm({ ...form, starting_kg: e.target.value })}
                                onBlur={computeRemaining}
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                                <Recycle className="w-3.5 h-3.5" /> Scrap (kg)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={form.scrap_kg}
                                onChange={(e) => setForm({ ...form, scrap_kg: e.target.value })}
                                onBlur={computeRemaining}
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1">Shortlength (kg)</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={form.shortlength_kg}
                                onChange={(e) => setForm({ ...form, shortlength_kg: e.target.value })}
                                onBlur={computeRemaining}
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                                <ArrowRight className="w-3.5 h-3.5" /> Coil Used (kg) *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                value={form.used_kg}
                                onChange={(e) => setForm({ ...form, used_kg: e.target.value })}
                                onBlur={computeRemaining}
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1">Remaining (kg) *</label>
                            <input
                                type="number"
                                step="0.01"
                                readOnly
                                value={form.remaining_kg}
                                className="w-full px-4 py-2.5 bg-black/60 border border-border rounded-xl text-sm text-foreground"
                            />
                        </div>
                        <div className="flex items-end gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.coil_ended}
                                    onChange={(e) => setForm({ ...form, coil_ended: e.target.checked })}
                                    className="rounded border-border bg-muted/50 text-amber-500 focus:ring-amber-500/50"
                                />
                                <span className="text-sm text-muted-foreground">Coil ended</span>
                            </label>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-medium text-muted-foreground mb-1">Notes</label>
                            <input
                                type="text"
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                placeholder="Optional"
                            />
                        </div>
                        <div className="md:col-span-2 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted/50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting || (parseFloat(form.remaining_kg) < 0)}
                                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl flex items-center gap-2"
                            >
                                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                Save Entry
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-card/60 border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-border text-sm font-medium text-muted-foreground">
                    Recent coil consumption log
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/30 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Coil</th>
                                <th className="px-4 py-3">Starting (kg)</th>
                                <th className="px-4 py-3">Scrap</th>
                                <th className="px-4 py-3">Shortlength</th>
                                <th className="px-4 py-3">Used (kg)</th>
                                <th className="px-4 py-3">Remaining (kg)</th>
                                <th className="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-foreground">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                                        Loading...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                                        No coil consumption entries yet. Add one above.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((row) => (
                                    <tr key={row.id} className="hover:bg-muted/50">
                                        <td className="px-4 py-3">
                                            {new Date(row.operation_date).toLocaleDateString("en-IN", {
                                                day: "2-digit",
                                                month: "2-digit",
                                                year: "numeric",
                                            })}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-foreground">
                                            {row.product_name} {row.product_type ? `(${row.product_type})` : ""}
                                        </td>
                                        <td className="px-4 py-3">{row.starting_kg}</td>
                                        <td className="px-4 py-3">{row.scrap_kg}</td>
                                        <td className="px-4 py-3">{row.shortlength_kg}</td>
                                        <td className="px-4 py-3">{row.used_kg}</td>
                                        <td className="px-4 py-3">{row.remaining_kg}</td>
                                        <td className="px-4 py-3">
                                            {row.coil_ended ? (
                                                <span className="inline-flex items-center gap-1 text-rose-400">
                                                    <CheckCircle2 className="w-4 h-4" /> COIL END
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
