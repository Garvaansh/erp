"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { API_URL } from "@/lib/api";
import { useMockData } from "@/app/(dashboard)/layout";
import {
    BarChart2,
    DollarSign,
    Activity,
    Package,
    RefreshCw,
    TrendingUp,
    Download,
    Calendar,
    Mail,
    Trash2,
    FileSpreadsheet,
    FileText,
} from "lucide-react";

interface DailySaleRow {
    sale_date: string;
    total_revenue: string | number;
}

interface ProductionRow {
    production_date: string;
    total_produced: string | number;
}

interface ReportData {
    daily_sales: DailySaleRow[];
    production_output: ProductionRow[];
    inventory_valuation: string | number;
}

interface ScheduledReport {
    id: string;
    name: string;
    report_type: string;
    frequency: string;
    export_format: string;
    recipient_email: string;
    next_run_at: string | null;
    last_run_at: string | null;
    created_at: string;
}

const DATE_PRESETS = [
    { label: "Last 7 days", value: "7" },
    { label: "Last 30 days", value: "30" },
    { label: "Last 90 days", value: "90" },
    { label: "Custom", value: "custom" },
] as const;

function parseNum(value: string | number | null | undefined): number {
    if (value == null) return 0;
    if (typeof value === "number") return value;
    const n = parseFloat(String(value));
    return Number.isFinite(n) ? n : 0;
}

function formatDate(isoOrDate: string | Record<string, unknown> | null | undefined): string {
    if (isoOrDate == null) return "—";
    let dateStr: string;
    if (typeof isoOrDate === "string") {
        dateStr = isoOrDate.split("T")[0];
    } else if (typeof isoOrDate === "object" && isoOrDate !== null) {
        const t = (isoOrDate as { Time?: string; time?: string; value?: string }).Time
            ?? (isoOrDate as { Time?: string; time?: string; value?: string }).time
            ?? (isoOrDate as { Time?: string; time?: string; value?: string }).value;
        dateStr = typeof t === "string" ? t.split("T")[0] : "";
    } else {
        return String(isoOrDate);
    }
    if (!dateStr) return "—";
    try {
        const d = new Date(dateStr + "T00:00:00Z");
        if (Number.isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    } catch {
        return dateStr;
    }
}

function toYYYYMMDD(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function getDateRangeForPreset(preset: string): { start: string; end: string } {
    const end = new Date();
    const start = new Date();
    if (preset === "custom") {
        start.setDate(start.getDate() - 30);
        return { start: toYYYYMMDD(start), end: toYYYYMMDD(end) };
    }
    const days = parseInt(preset, 10) || 30;
    start.setDate(start.getDate() - days);
    return { start: toYYYYMMDD(start), end: toYYYYMMDD(end) };
}

export default function ReportsPage() {
    const [data, setData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [datePreset, setDatePreset] = useState<string>("30");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [exporting, setExporting] = useState<"csv" | "excel" | null>(null);
    const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
    const [scheduleForm, setScheduleForm] = useState({
        name: "",
        report_type: "summary",
        frequency: "daily",
        export_format: "csv",
        recipient_email: "",
    });
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const { mockData } = useMockData();

    const effectiveRange = useCallback(() => {
        if (datePreset === "custom") {
            const s = startDate || toYYYYMMDD(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
            const e = endDate || toYYYYMMDD(new Date());
            return { start: s, end: e };
        }
        return getDateRangeForPreset(datePreset);
    }, [datePreset, startDate, endDate]);

    const fetchReports = useCallback(async () => {
        const { start, end } = effectiveRange();
        try {
            setLoading(true);
            setError(null);
            const res = await api.get("/reports", {
                params: { start_date: start, end_date: end },
            });
            setData(res.data);
        } catch (err: unknown) {
            const msg =
                err && typeof err === "object" && "response" in err
                    ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
                    : "Failed to load reports";
            setError(String(msg));
        } finally {
            setLoading(false);
        }
    }, [effectiveRange]);

    const fetchSchedules = useCallback(async () => {
        try {
            const res = await api.get("/reports/schedules");
            setSchedules(res.data?.schedules ?? []);
        } catch {
            setSchedules([]);
        }
    }, []);

    useEffect(() => {
        fetchReports();
    }, [fetchReports, mockData]);

    useEffect(() => {
        fetchSchedules();
    }, [fetchSchedules]);

    const handleExport = async (format: "csv" | "excel") => {
        const { start, end } = effectiveRange();
        setExporting(format);
        try {
            const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
            const url = `${API_URL}/reports/export?format=${format}&report=summary&start_date=${start}&end_date=${end}`;
            const res = await fetch(url, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) throw new Error("Export failed");
            const blob = await res.blob();
            const ext = format === "csv" ? "csv" : "xlsx";
            const name = `report_summary_${start}_${end}.${ext}`;
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = name;
            a.click();
            URL.revokeObjectURL(a.href);
        } catch {
            setError("Export failed. You may have hit the rate limit (15/minute).");
        } finally {
            setExporting(null);
        }
    };

    const handleCreateSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post("/reports/schedules", scheduleForm);
            setShowScheduleModal(false);
            setScheduleForm({ name: "", report_type: "summary", frequency: "daily", export_format: "csv", recipient_email: "" });
            fetchSchedules();
        } catch (err: unknown) {
            const msg = err && typeof err === "object" && "response" in err ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : "Failed to create schedule";
            setError(String(msg));
        }
    };

    const handleDeleteSchedule = async (id: string) => {
        if (!confirm("Remove this scheduled report?")) return;
        try {
            await api.delete(`/reports/schedules/${id}`);
            fetchSchedules();
        } catch {
            setError("Failed to delete schedule");
        }
    };

    const dailySales = data?.daily_sales ?? [];
    const productionOutput = data?.production_output ?? [];
    const valuation = parseNum(data?.inventory_valuation);
    const maxRevenue = Math.max(...dailySales.map((r) => parseNum(r.total_revenue)), 1);
    const maxProduced = Math.max(...productionOutput.map((r) => parseNum(r.total_produced)), 1);
    const { start, end } = effectiveRange();

    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                <RefreshCw className="w-8 h-8 animate-spin mb-4 text-indigo-400" />
                <p>Loading reports…</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-wrap justify-between items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Reports</h1>
                    <p className="text-muted-foreground">
                        Revenue, production output, and inventory valuation. Use date range to filter.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <select
                            value={datePreset}
                            onChange={(e) => setDatePreset(e.target.value)}
                            className="bg-muted/50 border border-border text-foreground text-sm py-2 px-3 rounded-xl focus:ring-1 focus:ring-indigo-500"
                        >
                            {DATE_PRESETS.map((p) => (
                                <option key={p.value} value={p.value}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    {datePreset === "custom" && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-muted/50 border border-border text-foreground text-sm py-2 px-3 rounded-xl"
                            />
                            <span className="text-muted-foreground">to</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-muted/50 border border-border text-foreground text-sm py-2 px-3 rounded-xl"
                            />
                        </div>
                    )}
                    <button
                        onClick={fetchReports}
                        disabled={loading}
                        className="bg-muted/50 border border-border hover:bg-muted text-foreground text-sm py-2 px-4 rounded-xl flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
                        Refresh
                    </button>
                    <div className="flex items-center gap-1 border-l border-border pl-3">
                        <Download className="w-4 h-4 text-muted-foreground" />
                        <button
                            onClick={() => handleExport("csv")}
                            disabled={!!exporting}
                            className="bg-muted/50 border border-border hover:bg-muted text-foreground text-sm py-2 px-3 rounded-xl flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <FileText className="w-4 h-4" />
                            CSV
                        </button>
                        <button
                            onClick={() => handleExport("excel")}
                            disabled={!!exporting}
                            className="bg-muted/50 border border-border hover:bg-muted text-foreground text-sm py-2 px-3 rounded-xl flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            Excel
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card/80 border border-border p-6 rounded-2xl shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-orange-500/20 transition-all" />
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center border border-orange-500/20">
                            <Package className="w-5 h-5 text-orange-400" />
                        </div>
                    </div>
                    <h3 className="text-muted-foreground text-sm font-medium mb-1 tracking-wide">Gross Inventory Valuation</h3>
                    <p className="text-3xl font-semibold text-foreground tracking-tight">₹{valuation.toLocaleString("en-IN")}</p>
                </div>
                <div className="bg-card/80 border border-border p-6 rounded-2xl shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-indigo-500/20 transition-all" />
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                            <DollarSign className="w-5 h-5 text-indigo-400" />
                        </div>
                    </div>
                    <h3 className="text-muted-foreground text-sm font-medium mb-1 tracking-wide">Total Revenue</h3>
                    <p className="text-3xl font-semibold text-foreground tracking-tight">
                        ₹{dailySales.reduce((acc, r) => acc + parseNum(r.total_revenue), 0).toLocaleString("en-IN")}
                    </p>
                </div>
                <div className="bg-card/80 border border-border p-6 rounded-2xl shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-emerald-500/20 transition-all" />
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                            <Activity className="w-5 h-5 text-emerald-400" />
                        </div>
                    </div>
                    <h3 className="text-muted-foreground text-sm font-medium mb-1 tracking-wide">Total Produced</h3>
                    <p className="text-3xl font-semibold text-foreground tracking-tight">
                        {productionOutput.reduce((acc, r) => acc + parseNum(r.total_produced), 0).toLocaleString("en-IN")} units
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card/80 border border-border rounded-2xl p-6 shadow-xl">
                    <h3 className="text-foreground font-medium flex items-center gap-2 mb-6">
                        <TrendingUp className="w-5 h-5 text-indigo-400" />
                        Revenue ({start} – {end})
                    </h3>
                    <div className="flex items-end gap-1 h-48 pb-4">
                        {dailySales.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No sales data</p>
                        ) : (
                            dailySales.slice(0, 30).reverse().map((row, i) => (
                                <div
                                    key={row.sale_date ?? i}
                                    className="flex-1 rounded-t min-h-[4px] bg-gradient-to-t from-indigo-500/30 to-indigo-500/70 hover:to-indigo-400 transition-colors"
                                    style={{ height: `${Math.max(4, (parseNum(row.total_revenue) / maxRevenue) * 100)}%` }}
                                    title={`${formatDate(row.sale_date)}: ₹${parseNum(row.total_revenue).toLocaleString()}`}
                                />
                            ))
                        )}
                    </div>
                </div>
                <div className="bg-card/80 border border-border rounded-2xl p-6 shadow-xl">
                    <h3 className="text-foreground font-medium flex items-center gap-2 mb-4">
                        <BarChart2 className="w-5 h-5 text-indigo-400" />
                        Daily Sales
                    </h3>
                    <div className="overflow-auto max-h-64 rounded-xl border border-border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 sticky top-0">
                                <tr>
                                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Date</th>
                                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Revenue</th>
                                </tr>
                            </thead>
                            <tbody className="text-foreground divide-y divide-white/5">
                                {dailySales.length === 0 ? (
                                    <tr>
                                        <td colSpan={2} className="py-4 text-center text-muted-foreground">No data</td>
                                    </tr>
                                ) : (
                                    dailySales.map((row, i) => (
                                        <tr key={row.sale_date ?? i}>
                                            <td className="py-2 px-3">{formatDate(row.sale_date)}</td>
                                            <td className="py-2 px-3 text-right text-foreground font-medium">
                                                ₹{parseNum(row.total_revenue).toLocaleString("en-IN")}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card/80 border border-border rounded-2xl p-6 shadow-xl">
                    <h3 className="text-foreground font-medium flex items-center gap-2 mb-6">
                        <Activity className="w-5 h-5 text-emerald-400" />
                        Production Output ({start} – {end})
                    </h3>
                    <div className="flex items-end gap-1 h-48 pb-4">
                        {productionOutput.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No production data</p>
                        ) : (
                            productionOutput.slice(0, 30).reverse().map((row, i) => (
                                <div
                                    key={row.production_date ?? i}
                                    className="flex-1 rounded-t min-h-[4px] bg-gradient-to-t from-emerald-500/30 to-emerald-500/70 hover:to-emerald-400 transition-colors"
                                    style={{ height: `${Math.max(4, (parseNum(row.total_produced) / maxProduced) * 100)}%` }}
                                    title={`${formatDate(row.production_date)}: ${parseNum(row.total_produced).toLocaleString()} units`}
                                />
                            ))
                        )}
                    </div>
                </div>
                <div className="bg-card/80 border border-border rounded-2xl p-6 shadow-xl">
                    <h3 className="text-foreground font-medium flex items-center gap-2 mb-4">
                        <BarChart2 className="w-5 h-5 text-emerald-400" />
                        Daily Production
                    </h3>
                    <div className="overflow-auto max-h-64 rounded-xl border border-border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 sticky top-0">
                                <tr>
                                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Date</th>
                                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Units</th>
                                </tr>
                            </thead>
                            <tbody className="text-foreground divide-y divide-white/5">
                                {productionOutput.length === 0 ? (
                                    <tr>
                                        <td colSpan={2} className="py-4 text-center text-muted-foreground">No data</td>
                                    </tr>
                                ) : (
                                    productionOutput.map((row, i) => (
                                        <tr key={row.production_date ?? i}>
                                            <td className="py-2 px-3">{formatDate(row.production_date)}</td>
                                            <td className="py-2 px-3 text-right text-foreground font-medium">
                                                {parseNum(row.total_produced).toLocaleString("en-IN")}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Scheduled Reports */}
            <div className="bg-card/80 border border-border rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-foreground font-medium flex items-center gap-2">
                        <Mail className="w-5 h-5 text-indigo-400" />
                        Scheduled Reports
                    </h3>
                    <button
                        onClick={() => setShowScheduleModal(true)}
                        className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 text-sm py-2 px-4 rounded-xl border border-indigo-500/30"
                    >
                        + Schedule report
                    </button>
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                    Schedule reports to be generated and sent by email (delivery runs via backend job; configure SMTP for production).
                </p>
                <div className="overflow-auto rounded-xl border border-border">
                    {schedules.length === 0 ? (
                        <p className="py-6 text-center text-muted-foreground text-sm">No scheduled reports. Create one to receive reports by email.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Name</th>
                                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Report</th>
                                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Frequency</th>
                                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Format</th>
                                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Recipient</th>
                                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-foreground divide-y divide-white/5">
                                {schedules.map((s) => (
                                    <tr key={s.id}>
                                        <td className="py-2 px-3 text-foreground font-medium">{s.name}</td>
                                        <td className="py-2 px-3">{s.report_type}</td>
                                        <td className="py-2 px-3">{s.frequency}</td>
                                        <td className="py-2 px-3">{s.export_format}</td>
                                        <td className="py-2 px-3">{s.recipient_email}</td>
                                        <td className="py-2 px-3 text-right">
                                            <button
                                                onClick={() => handleDeleteSchedule(s.id)}
                                                className="text-red-400 hover:text-red-300 p-1 rounded"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {showScheduleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowScheduleModal(false)}>
                    <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-foreground mb-4">Schedule report</h3>
                        <form onSubmit={handleCreateSchedule} className="space-y-4">
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">Name</label>
                                <input
                                    required
                                    value={scheduleForm.name}
                                    onChange={(e) => setScheduleForm((f) => ({ ...f, name: e.target.value }))}
                                    className="w-full bg-muted/50 border border-border text-foreground rounded-xl px-3 py-2"
                                    placeholder="e.g. Weekly summary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">Report type</label>
                                <select
                                    value={scheduleForm.report_type}
                                    onChange={(e) => setScheduleForm((f) => ({ ...f, report_type: e.target.value }))}
                                    className="w-full bg-muted/50 border border-border text-foreground rounded-xl px-3 py-2"
                                >
                                    <option value="summary">Summary</option>
                                    <option value="daily_sales">Daily sales</option>
                                    <option value="production_output">Production output</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">Frequency</label>
                                <select
                                    value={scheduleForm.frequency}
                                    onChange={(e) => setScheduleForm((f) => ({ ...f, frequency: e.target.value }))}
                                    className="w-full bg-muted/50 border border-border text-foreground rounded-xl px-3 py-2"
                                >
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">Format</label>
                                <select
                                    value={scheduleForm.export_format}
                                    onChange={(e) => setScheduleForm((f) => ({ ...f, export_format: e.target.value }))}
                                    className="w-full bg-muted/50 border border-border text-foreground rounded-xl px-3 py-2"
                                >
                                    <option value="csv">CSV</option>
                                    <option value="excel">Excel</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">Recipient email</label>
                                <input
                                    required
                                    type="email"
                                    value={scheduleForm.recipient_email}
                                    onChange={(e) => setScheduleForm((f) => ({ ...f, recipient_email: e.target.value }))}
                                    className="w-full bg-muted/50 border border-border text-foreground rounded-xl px-3 py-2"
                                    placeholder="user@example.com"
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded-xl">
                                    Create
                                </button>
                                <button type="button" onClick={() => setShowScheduleModal(false)} className="px-4 py-2 rounded-xl border border-border text-muted-foreground hover:bg-muted/50">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
