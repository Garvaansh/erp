"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import Link from "next/link";
import { ArrowLeft, Wrench, Package, Layers, Plus, CheckCircle, XCircle } from "lucide-react";

interface WorkOrder {
    id: string;
    wo_number: string;
    product_id: string;
    bom_id: string | null;
    sales_order_id: string | null;
    status: string;
    planned_quantity: string;
    produced_quantity: string;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
    operation_type?: string | null;
    production_order_id?: string | null;
}

interface ProductionLog {
    id: string;
    work_order_id: string;
    warehouse_id: string;
    quantity: string;
    produced_at: string;
    notes: string | null;
}

interface MaterialConsumptionRow {
    id: string;
    work_order_id: string;
    product_id: string;
    warehouse_id: string;
    quantity: string;
    consumed_at: string;
}

interface QualityInspection {
    id: string;
    work_order_id: string;
    result: string;
    notes: string | null;
    inspected_at: string;
    created_at: string;
}

interface Product {
    id: string;
    name: string;
}
interface Warehouse {
    id: string;
    name: string;
}

export default function WorkOrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const [wo, setWo] = useState<WorkOrder | null>(null);
    const [logs, setLogs] = useState<ProductionLog[]>([]);
    const [consumption, setConsumption] = useState<MaterialConsumptionRow[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState("");
    const [showLogModal, setShowLogModal] = useState(false);
    const [showConsumptionModal, setShowConsumptionModal] = useState(false);
    const [productionLogForm, setProductionLogForm] = useState({
        warehouse_id: "",
        quantity: "",
        notes: "",
    });
    const [consumptionForm, setConsumptionForm] = useState({
        product_id: "",
        warehouse_id: "",
        quantity: "",
    });
    const [inspections, setInspections] = useState<QualityInspection[]>([]);
    const [showInspectionModal, setShowInspectionModal] = useState(false);
    const [inspectionForm, setInspectionForm] = useState({ result: "PASS" as "PASS" | "FAIL", notes: "" });

    useEffect(() => {
        if (!id) return;
        fetchAll();
    }, [id]);

    const fetchAll = async () => {
        try {
            setLoading(true);
            const [woRes, logsRes, consRes, inspRes, productRes, whRes] = await Promise.all([
                api.get(`/manufacturing/work-orders/${id}`),
                api.get(`/manufacturing/work-orders/${id}/production-logs`),
                api.get(`/manufacturing/work-orders/${id}/material-consumption`),
                api.get(`/manufacturing/work-orders/${id}/quality-inspections`).catch(() => ({ data: [] })),
                api.get("/inventory/products"),
                api.get("/inventory/warehouses"),
            ]);
            setWo(woRes.data);
            setStatus(woRes.data?.status || "");
            setLogs(logsRes.data || []);
            setConsumption(consRes.data || []);
            setInspections(Array.isArray(inspRes.data) ? inspRes.data : []);
            setProducts(productRes.data || []);
            setWarehouses(whRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async () => {
        if (!wo || status === wo.status) return;
        try {
            await api.patch(`/manufacturing/work-orders/${id}`, { status });
            setWo((prev) => (prev ? { ...prev, status } : null));
        } catch (err) {
            console.error(err);
            alert("Failed to update status");
        }
    };

    const submitProductionLog = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post("/manufacturing/production-log", {
                work_order_id: id,
                warehouse_id: productionLogForm.warehouse_id,
                quantity: productionLogForm.quantity,
                notes: productionLogForm.notes || undefined,
            });
            setShowLogModal(false);
            setProductionLogForm({ warehouse_id: "", quantity: "", notes: "" });
            fetchAll();
        } catch (err) {
            console.error(err);
            alert("Failed to record production log");
        }
    };

    const submitMaterialConsumption = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post("/manufacturing/material-consumption", {
                work_order_id: id,
                product_id: consumptionForm.product_id,
                warehouse_id: consumptionForm.warehouse_id,
                quantity: consumptionForm.quantity,
            });
            setShowConsumptionModal(false);
            setConsumptionForm({ product_id: "", warehouse_id: "", quantity: "" });
            fetchAll();
        } catch (err) {
            console.error(err);
            alert("Failed to record material consumption");
        }
    };

    const submitInspection = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post("/manufacturing/quality-inspections", {
                work_order_id: id,
                result: inspectionForm.result,
                notes: inspectionForm.notes || undefined,
            });
            setShowInspectionModal(false);
            setInspectionForm({ result: "PASS", notes: "" });
            fetchAll();
        } catch (err) {
            console.error(err);
            alert("Failed to record quality inspection");
        }
    };

    const getProductName = (productId: string) => products.find((p) => p.id === productId)?.name ?? "—";
    const getWarehouseName = (whId: string) => warehouses.find((w) => w.id === whId)?.name ?? "—";

    const getStatusColor = (s: string) => {
        switch (s) {
            case "PLANNED":
                return "bg-zinc-500/10 text-muted-foreground border-zinc-500/20";
            case "IN_PROGRESS":
                return "bg-amber-500/10 text-amber-400 border-amber-500/20";
            case "COMPLETED":
                return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            case "CANCELLED":
                return "bg-red-500/10 text-red-400 border-red-500/20";
            default:
                return "bg-zinc-500/10 text-muted-foreground border-zinc-500/20";
        }
    };

    if (loading && !wo) {
        return (
            <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
                Loading work order...
            </div>
        );
    }
    if (!wo) {
        return (
            <div className="space-y-6">
                <Link href="/work-orders" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="w-4 h-4" /> Back to Work Orders
                </Link>
                <p className="text-muted-foreground">Work order not found.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-4">
                <Link
                    href="/work-orders"
                    className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                >
                    <ArrowLeft className="w-4 h-4" />
                </Link>
                <div className="flex gap-4 items-center flex-1">
                    <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
                        <Wrench className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{wo.wo_number}</h1>
                        <p className="text-sm text-muted-foreground">
                            Product: {getProductName(wo.product_id)} · Planned: {parseFloat(wo.planned_quantity).toLocaleString()} · Produced:{" "}
                            {parseFloat(wo.produced_quantity || "0").toLocaleString()}
                            {wo.operation_type && (
                                <> · <span className="text-amber-400">{wo.operation_type}</span></>
                            )}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card/80 border border-border rounded-2xl p-6">
                    <h3 className="text-sm font-medium text-muted-foreground mb-4">Details</h3>
                    <dl className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Status</dt>
                            <dd className="flex items-center gap-2">
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    onBlur={updateStatus}
                                    className="bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-foreground text-sm focus:ring-2 focus:ring-amber-500/50"
                                >
                                    <option value="PLANNED">PLANNED</option>
                                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                                    <option value="COMPLETED">COMPLETED</option>
                                    <option value="CANCELLED">CANCELLED</option>
                                </select>
                            </dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Start / End</dt>
                            <dd className="text-foreground">
                                {wo.start_date ? new Date(wo.start_date).toLocaleDateString() : "—"} /{" "}
                                {wo.end_date ? new Date(wo.end_date).toLocaleDateString() : "—"}
                            </dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Created</dt>
                            <dd className="text-foreground">{new Date(wo.created_at).toLocaleString()}</dd>
                        </div>
                        {wo.production_order_id && (
                            <div className="flex justify-between">
                                <dt className="text-muted-foreground">Production Order</dt>
                                <dd className="text-foreground">
                                    <Link href={`/production-orders/${wo.production_order_id}`} className="text-amber-400 hover:text-amber-300">View PO</Link>
                                </dd>
                            </div>
                        )}
                    </dl>
                </div>
            </div>

            <div className="bg-card/60 border border-border rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-border flex justify-between items-center">
                    <h3 className="font-medium text-foreground flex items-center gap-2">
                        <Layers className="w-4 h-4 text-amber-400" /> Production logs
                    </h3>
                    <button
                        onClick={() => setShowLogModal(true)}
                        className="text-sm bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1"
                    >
                        <Plus className="w-4 h-4" /> Add log
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/30 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 text-left">Warehouse</th>
                                <th className="px-4 py-3 text-left">Quantity</th>
                                <th className="px-4 py-3 text-left">Produced at</th>
                                <th className="px-4 py-3 text-left">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-foreground">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                                        No production logs yet.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id}>
                                        <td className="px-4 py-3">{getWarehouseName(log.warehouse_id)}</td>
                                        <td className="px-4 py-3 font-mono">{parseFloat(log.quantity).toLocaleString()}</td>
                                        <td className="px-4 py-3">{new Date(log.produced_at).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{log.notes || "—"}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-card/60 border border-border rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-border flex justify-between items-center">
                    <h3 className="font-medium text-foreground flex items-center gap-2">
                        <Package className="w-4 h-4 text-amber-400" /> Material consumption
                    </h3>
                    <button
                        onClick={() => setShowConsumptionModal(true)}
                        className="text-sm bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1"
                    >
                        <Plus className="w-4 h-4" /> Record consumption
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/30 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 text-left">Product</th>
                                <th className="px-4 py-3 text-left">Warehouse</th>
                                <th className="px-4 py-3 text-left">Quantity</th>
                                <th className="px-4 py-3 text-left">Consumed at</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-foreground">
                            {consumption.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                                        No material consumption recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                consumption.map((row) => (
                                    <tr key={row.id}>
                                        <td className="px-4 py-3">{getProductName(row.product_id)}</td>
                                        <td className="px-4 py-3">{getWarehouseName(row.warehouse_id)}</td>
                                        <td className="px-4 py-3 font-mono">{parseFloat(row.quantity).toLocaleString()}</td>
                                        <td className="px-4 py-3">{new Date(row.consumed_at).toLocaleString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-card/60 border border-border rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-border flex justify-between items-center">
                    <h3 className="font-medium text-foreground flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-amber-400" /> Quality inspections
                    </h3>
                    <button
                        onClick={() => setShowInspectionModal(true)}
                        className="text-sm bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1"
                    >
                        <Plus className="w-4 h-4" /> Record inspection
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/30 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 text-left">Result</th>
                                <th className="px-4 py-3 text-left">Notes</th>
                                <th className="px-4 py-3 text-left">Inspected at</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-foreground">
                            {inspections.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                                        No quality inspections yet.
                                    </td>
                                </tr>
                            ) : (
                                inspections.map((qi) => (
                                    <tr key={qi.id}>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${qi.result === "PASS" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                                                {qi.result === "PASS" ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                                {qi.result}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">{qi.notes || "—"}</td>
                                        <td className="px-4 py-3">{new Date(qi.inspected_at).toLocaleString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showLogModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                            <h3 className="text-lg font-medium text-foreground">Record production log</h3>
                            <button onClick={() => setShowLogModal(false)} className="text-muted-foreground hover:text-foreground text-xl">
                                &times;
                            </button>
                        </div>
                        <form onSubmit={submitProductionLog} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Warehouse</label>
                                <select
                                    required
                                    value={productionLogForm.warehouse_id}
                                    onChange={(e) => setProductionLogForm({ ...productionLogForm, warehouse_id: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                >
                                    <option value="">Select warehouse</option>
                                    {warehouses.map((w) => (
                                        <option key={w.id} value={w.id}>
                                            {w.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Quantity</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    required
                                    value={productionLogForm.quantity}
                                    onChange={(e) => setProductionLogForm({ ...productionLogForm, quantity: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
                                <input
                                    type="text"
                                    value={productionLogForm.notes}
                                    onChange={(e) => setProductionLogForm({ ...productionLogForm, notes: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowLogModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                                    Cancel
                                </button>
                                <button type="submit" className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl">
                                    Record
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showConsumptionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                            <h3 className="text-lg font-medium text-foreground">Record material consumption</h3>
                            <button onClick={() => setShowConsumptionModal(false)} className="text-muted-foreground hover:text-foreground text-xl">
                                &times;
                            </button>
                        </div>
                        <form onSubmit={submitMaterialConsumption} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Product (material)</label>
                                <select
                                    required
                                    value={consumptionForm.product_id}
                                    onChange={(e) => setConsumptionForm({ ...consumptionForm, product_id: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                >
                                    <option value="">Select product</option>
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Warehouse</label>
                                <select
                                    required
                                    value={consumptionForm.warehouse_id}
                                    onChange={(e) => setConsumptionForm({ ...consumptionForm, warehouse_id: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                >
                                    <option value="">Select warehouse</option>
                                    {warehouses.map((w) => (
                                        <option key={w.id} value={w.id}>
                                            {w.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Quantity</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    required
                                    value={consumptionForm.quantity}
                                    onChange={(e) => setConsumptionForm({ ...consumptionForm, quantity: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowConsumptionModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                                    Cancel
                                </button>
                                <button type="submit" className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl">
                                    Record
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showInspectionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                            <h3 className="text-lg font-medium text-foreground">Quality inspection</h3>
                            <button onClick={() => setShowInspectionModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
                        </div>
                        <form onSubmit={submitInspection} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Result</label>
                                <select
                                    value={inspectionForm.result}
                                    onChange={(e) => setInspectionForm({ ...inspectionForm, result: e.target.value as "PASS" | "FAIL" })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                >
                                    <option value="PASS">PASS</option>
                                    <option value="FAIL">FAIL</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
                                <input
                                    type="text"
                                    value={inspectionForm.notes}
                                    onChange={(e) => setInspectionForm({ ...inspectionForm, notes: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowInspectionModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                                <button type="submit" className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl">Record</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
