"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useMockData } from "@/app/(dashboard)/layout";
import {
    Plus,
    Search,
    Package,
    Warehouse as WarehouseIcon,
    ArrowDownToLine,
    ArrowUpFromLine,
    ClipboardList,
    MoreVertical,
    AlertTriangle,
    Truck,
    Layers,
    Tag,
} from "lucide-react";

interface Product {
    id: string;
    name: string;
    sku: string;
    price: string;
    created_at: string;
}

interface Warehouse {
    id: string;
    name: string;
    location: string | null;
    created_at: string;
}

interface StockLevel {
    product_id: string;
    product_name: string;
    product_sku: string;
    total_stock: string;
}

interface InventoryTransaction {
    id: string;
    product_id: string;
    warehouse_id: string;
    transaction_type: string;
    quantity: string;
    notes: string | null;
    created_at: string;
}

interface LowStockAlert {
    product_id: string;
    product_name: string;
    product_sku: string;
    reorder_point: string;
    safety_stock: string;
    uom: string;
    current_stock: string;
}

interface StockByWarehouseRow {
    product_id: string;
    product_name: string;
    product_sku: string;
    warehouse_id: string;
    warehouse_name: string;
    quantity: string;
}

interface WarehouseTransfer {
    id: string;
    from_warehouse_id: string;
    to_warehouse_id: string;
    product_id: string;
    quantity: string;
    status: string;
    notes: string | null;
    created_at: string;
    completed_at: string | null;
}

interface InventoryReservation {
    id: string;
    product_id: string;
    warehouse_id: string;
    quantity: string;
    reference_type: string;
    reference_id: string;
    status: string;
    reserved_at: string;
}

interface ProductBatch {
    id: string;
    product_id: string;
    batch_number: string;
    manufacture_date: string | null;
    expiry_date: string | null;
    created_at: string;
}

interface InventoryKpis {
    total_skus: number | string;
    total_inventory_value: any;
    low_stock_items: number | string;
    out_of_stock_items: number | string;
    reserved_qty: any;
    in_transit_qty: any;
    dead_stock_items: number | string;
    dead_days?: number | string;
}

function parseNum(v: unknown): string {
    if (v == null) return "0";
    if (typeof v === "number") return String(v);
    if (typeof v === "string") return v;
    return "0";
}

export default function InventoryPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
    const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
    const [kpis, setKpis] = useState<InventoryKpis | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchStock, setSearchStock] = useState("");
    const [searchTx, setSearchTx] = useState("");
    const [txTypeFilter, setTxTypeFilter] = useState<"ALL" | "IN" | "OUT" | "ADJUSTMENT">("ALL");
    const [searchWarehouse, setSearchWarehouse] = useState("");
    const [searchTransfer, setSearchTransfer] = useState("");
    const [transferStatusFilter, setTransferStatusFilter] = useState<"ALL" | "PENDING" | "COMPLETED">("ALL");
    const [searchReservation, setSearchReservation] = useState("");

    const [showWarehouseModal, setShowWarehouseModal] = useState(false);
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [newWarehouse, setNewWarehouse] = useState({ name: "", location: "" });
    const [newTransaction, setNewTransaction] = useState({
        product_id: "",
        warehouse_id: "",
        transaction_type: "IN" as "IN" | "OUT" | "ADJUSTMENT",
        transaction_reason: "RECEIPT",
        quantity: "",
        notes: "",
    });
    const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
    const [stockByWarehouse, setStockByWarehouse] = useState<StockByWarehouseRow[]>([]);
    const [transfers, setTransfers] = useState<WarehouseTransfer[]>([]);
    const [reservations, setReservations] = useState<InventoryReservation[]>([]);
    const [viewStockMode, setViewStockMode] = useState<"total" | "by_warehouse">("total");
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [newTransfer, setNewTransfer] = useState({
        from_warehouse_id: "",
        to_warehouse_id: "",
        product_id: "",
        quantity: "",
        notes: "",
    });
    const [newBatch, setNewBatch] = useState({
        product_id: "",
        batch_number: "",
        manufacture_date: "",
        expiry_date: "",
    });
    const [batchesForProduct, setBatchesForProduct] = useState<ProductBatch[]>([]);
    const [completingTransferId, setCompletingTransferId] = useState<string | null>(null);
    const { mockData } = useMockData();

    const [detailOpen, setDetailOpen] = useState(false);
    const [detailProductId, setDetailProductId] = useState<string | null>(null);
    const [detailWarehouseId, setDetailWarehouseId] = useState<string | null>(null);
    const [detailTransactions, setDetailTransactions] = useState<InventoryTransaction[]>([]);
    const [detailBatches, setDetailBatches] = useState<ProductBatch[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);

    const fetchAll = async () => {
        try {
            setLoading(true);
            const q = mockData ? "?limit=50&offset=0" : "";
            const safeGet = (url: string, label: string) =>
                api.get(url).catch((err) => {
                    console.warn(`Inventory fetch failed (${label}):`, err?.response?.status ?? err?.message);
                    return { data: [], headers: {} };
                });
            const safeGetObj = (url: string, label: string) =>
                api.get(url).catch((err) => {
                    console.warn(`Inventory fetch failed (${label}):`, err?.response?.status ?? err?.message);
                    return { data: null, headers: {} };
                });

            const [productsRes, warehousesRes, stockRes, txRes, alertsRes, byWhRes, transfersRes, resvRes, kpisRes] = await Promise.all([
                safeGet(`/inventory/products${q}`, "products"),
                safeGet(`/inventory/warehouses${q}`, "warehouses"),
                safeGet(`/inventory/stock-levels${q}`, "stock-levels"),
                safeGet(mockData ? "/inventory/transactions?limit=50&offset=0" : "/inventory/transactions?limit=50", "transactions"),
                safeGet(`/inventory/low-stock-alerts${q}`, "low-stock-alerts"),
                safeGet(`/inventory/stock-by-warehouse${q}`, "stock-by-warehouse"),
                safeGet(mockData ? "/inventory/transfers?limit=30&offset=0" : "/inventory/transfers?limit=30", "transfers"),
                safeGet(mockData ? "/inventory/reservations?limit=20&offset=0" : "/inventory/reservations?limit=20", "reservations"),
                safeGetObj(`/inventory/kpis`, "kpis"),
            ]);
            setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
            setWarehouses(Array.isArray(warehousesRes.data) ? warehousesRes.data : []);
            setStockLevels(Array.isArray(stockRes.data) ? stockRes.data : []);
            setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
            setLowStockAlerts(Array.isArray(alertsRes.data) ? alertsRes.data : []);
            setStockByWarehouse(Array.isArray(byWhRes.data) ? byWhRes.data : []);
            setTransfers(Array.isArray(transfersRes.data) ? transfersRes.data : []);
            setReservations(Array.isArray(resvRes.data) ? resvRes.data : []);
            setKpis(kpisRes.data ?? null);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, [mockData]);

    const openDetail = async (productId: string, warehouseId?: string) => {
        setDetailOpen(true);
        setDetailProductId(productId);
        setDetailWarehouseId(warehouseId ?? null);
        setDetailLoading(true);
        try {
            const txUrl = warehouseId
                ? `/inventory/transactions?limit=50&product_id=${encodeURIComponent(productId)}&warehouse_id=${encodeURIComponent(warehouseId)}`
                : `/inventory/transactions?limit=50&product_id=${encodeURIComponent(productId)}`;
            const [txRes, batchesRes] = await Promise.all([
                api.get(txUrl).catch(() => ({ data: [] })),
                api.get(`/inventory/product/${encodeURIComponent(productId)}/batches`).catch(() => ({ data: [] })),
            ]);
            setDetailTransactions(Array.isArray(txRes.data) ? txRes.data : []);
            setDetailBatches(Array.isArray(batchesRes.data) ? batchesRes.data : []);
        } finally {
            setDetailLoading(false);
        }
    };

    const closeDetail = () => {
        setDetailOpen(false);
        setDetailProductId(null);
        setDetailWarehouseId(null);
        setDetailTransactions([]);
        setDetailBatches([]);
        setDetailLoading(false);
    };

    const createWarehouse = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post("/inventory/warehouses", newWarehouse);
            setShowWarehouseModal(false);
            setNewWarehouse({ name: "", location: "" });
            fetchAll();
        } catch (err) {
            console.error(err);
            alert("Failed to create warehouse");
        }
    };

    const createTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTransfer.from_warehouse_id || !newTransfer.to_warehouse_id || newTransfer.from_warehouse_id === newTransfer.to_warehouse_id || !newTransfer.product_id || !newTransfer.quantity) {
            alert("Select different from/to warehouses, product, and quantity.");
            return;
        }
        try {
            await api.post("/inventory/transfers", newTransfer);
            setShowTransferModal(false);
            setNewTransfer({ from_warehouse_id: "", to_warehouse_id: "", product_id: "", quantity: "", notes: "" });
            fetchAll();
        } catch (err) {
            console.error(err);
            alert("Failed to create transfer");
        }
    };

    const completeTransfer = async (id: string) => {
        try {
            setCompletingTransferId(id);
            await api.post(`/inventory/transfers/${id}/complete`);
            fetchAll();
        } catch (err) {
            console.error(err);
            alert("Failed to complete transfer");
        } finally {
            setCompletingTransferId(null);
        }
    };

    const handleBatchProductChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const v = e.target.value;
        setNewBatch((prev) => ({ ...prev, product_id: v }));
        if (v) {
            try {
                const r = await api.get(`/inventory/product/${v}/batches`);
                setBatchesForProduct(r.data || []);
            } catch {
                setBatchesForProduct([]);
            }
        } else {
            setBatchesForProduct([]);
        }
    };

    const createBatch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBatch.product_id || !newBatch.batch_number) {
            alert("Select product and enter batch number.");
            return;
        }
        try {
            await api.post("/inventory/batches", {
                product_id: newBatch.product_id,
                batch_number: newBatch.batch_number,
                manufacture_date: newBatch.manufacture_date || undefined,
                expiry_date: newBatch.expiry_date || undefined,
            });
            setShowBatchModal(false);
            setNewBatch({ product_id: "", batch_number: "", manufacture_date: "", expiry_date: "" });
            setBatchesForProduct([]);
            fetchAll();
        } catch (err) {
            console.error(err);
            alert("Failed to create batch");
        }
    };

    const recordTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTransaction.product_id || !newTransaction.warehouse_id || !newTransaction.quantity) {
            alert("Please select product, warehouse, and enter quantity.");
            return;
        }
        try {
            await api.post("/inventory/transaction", {
                product_id: newTransaction.product_id,
                warehouse_id: newTransaction.warehouse_id,
                transaction_type: newTransaction.transaction_type,
                transaction_reason: newTransaction.transaction_reason,
                quantity: newTransaction.quantity,
                notes: newTransaction.notes || undefined,
            });
            setShowTransactionModal(false);
            setNewTransaction({
                product_id: "",
                warehouse_id: "",
                transaction_type: "IN",
                transaction_reason: "RECEIPT",
                quantity: "",
                notes: "",
            });
            fetchAll();
        } catch (err) {
            console.error(err);
            alert("Failed to record movement");
        }
    };

    const productById = (id: string) => products.find((p) => p.id === id);
    const warehouseById = (id: string) => warehouses.find((w) => w.id === id);

    const filteredStock = stockLevels.filter(
        (s) =>
            s.product_name.toLowerCase().includes(searchStock.toLowerCase()) ||
            s.product_sku.toLowerCase().includes(searchStock.toLowerCase())
    );
    const filteredTx = transactions.filter((t) => {
        if (txTypeFilter !== "ALL" && t.transaction_type !== txTypeFilter) return false;
        const p = productById(t.product_id);
        const w = warehouseById(t.warehouse_id);
        const term = searchTx.toLowerCase();
        if (term) {
            if (!p?.name.toLowerCase().includes(term) && !p?.sku.toLowerCase().includes(term) && !w?.name.toLowerCase().includes(term) && !t.notes?.toLowerCase().includes(term)) return false;
        }
        return true;
    });
    const filteredWarehouses = warehouses.filter(
        (w) =>
            w.name.toLowerCase().includes(searchWarehouse.toLowerCase()) ||
            (w.location && w.location.toLowerCase().includes(searchWarehouse.toLowerCase()))
    );
    const filteredTransfers = transfers.filter((tr) => {
        if (transferStatusFilter === "PENDING" && tr.status === "COMPLETED") return false;
        if (transferStatusFilter === "COMPLETED" && tr.status !== "COMPLETED") return false;
        const term = searchTransfer.toLowerCase();
        if (!term) return true;
        const fromWh = warehouseById(tr.from_warehouse_id);
        const toWh = warehouseById(tr.to_warehouse_id);
        const prod = productById(tr.product_id);
        return fromWh?.name.toLowerCase().includes(term) || toWh?.name.toLowerCase().includes(term) || prod?.name.toLowerCase().includes(term) || prod?.sku.toLowerCase().includes(term);
    });
    const filteredReservations = reservations.filter((r) => {
        const term = searchReservation.toLowerCase();
        if (!term) return true;
        const p = productById(r.product_id);
        const w = warehouseById(r.warehouse_id);
        return p?.name.toLowerCase().includes(term) || p?.sku.toLowerCase().includes(term) || w?.name.toLowerCase().includes(term) || r.reference_type.toLowerCase().includes(term);
    });

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex justify-between items-center bg-card/80 border border-border p-6 rounded-2xl shadow-xl">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
                        <Package className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
                            Inventory Management
                        </h1>
                        <p className="text-sm text-foreground/80">
                            Stock levels, warehouses, and stock ledger.
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 flex-wrap">
                    <button
                        onClick={() => setShowWarehouseModal(true)}
                        className="bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all border border-border"
                    >
                        <WarehouseIcon className="w-4 h-4" />
                        Add Warehouse
                    </button>
                    <button
                        onClick={() => { setShowTransferModal(true); setNewTransfer({ from_warehouse_id: "", to_warehouse_id: "", product_id: "", quantity: "", notes: "" }); }}
                        className="bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all border border-border"
                    >
                        <Truck className="w-4 h-4" />
                        Transfer
                    </button>
                    <button
                        onClick={() => { setShowBatchModal(true); setNewBatch({ product_id: "", batch_number: "", manufacture_date: "", expiry_date: "" }); }}
                        className="bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all border border-border"
                    >
                        <Tag className="w-4 h-4" />
                        New Batch
                    </button>
                    <button
                        onClick={() => setShowTransactionModal(true)}
                        className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                    >
                        <Plus className="w-4 h-4" />
                        Record Movement
                    </button>
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-card/60 border border-border rounded-2xl p-4 shadow-xl">
                    <div className="text-xs text-muted-foreground mb-1">Total inventory value</div>
                    <div className="text-2xl font-bold text-foreground">
                        ₹{parseFloat(parseNum((kpis as any)?.total_inventory_value)).toLocaleString("en-IN")}
                    </div>
                </div>
                <div className="bg-card/60 border border-border rounded-2xl p-4 shadow-xl">
                    <div className="text-xs text-muted-foreground mb-1">Total SKUs</div>
                    <div className="text-2xl font-bold text-foreground">
                        {parseFloat(parseNum((kpis as any)?.total_skus)).toLocaleString("en-IN")}
                    </div>
                </div>
                <div className="bg-card/60 border border-border rounded-2xl p-4 shadow-xl">
                    <div className="text-xs text-muted-foreground mb-1">Low / out of stock</div>
                    <div className="text-2xl font-bold text-foreground">
                        {parseFloat(parseNum((kpis as any)?.low_stock_items)).toLocaleString("en-IN")}
                        <span className="text-sm font-medium text-muted-foreground"> low</span>
                        <span className="mx-2 text-muted-foreground">·</span>
                        {parseFloat(parseNum((kpis as any)?.out_of_stock_items)).toLocaleString("en-IN")}
                        <span className="text-sm font-medium text-muted-foreground"> out</span>
                    </div>
                </div>
                <div className="bg-card/60 border border-border rounded-2xl p-4 shadow-xl">
                    <div className="text-xs text-muted-foreground mb-1">Reserved / in transit / dead stock</div>
                    <div className="text-sm font-semibold text-foreground">
                        {parseFloat(parseNum((kpis as any)?.reserved_qty)).toLocaleString("en-IN")} reserved
                        <span className="mx-2 text-muted-foreground">·</span>
                        {parseFloat(parseNum((kpis as any)?.in_transit_qty)).toLocaleString("en-IN")} in transit
                        <span className="mx-2 text-muted-foreground">·</span>
                        {parseFloat(parseNum((kpis as any)?.dead_stock_items)).toLocaleString("en-IN")} dead
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                        Dead stock = no movement in {parseFloat(parseNum((kpis as any)?.dead_days ?? 90)).toLocaleString("en-IN")} days
                    </div>
                </div>
            </div>

            {/* Low-stock alerts */}
            {lowStockAlerts.length > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-rose-800 dark:text-rose-200 mb-1">Low stock alerts</h3>
                        <p className="text-xs text-muted-foreground mb-3">Products below reorder point. Consider replenishing.</p>
                        <div className="flex flex-wrap gap-2">
                            {lowStockAlerts.slice(0, 8).map((a) => (
                                <span
                                    key={a.product_id}
                                    className="px-3 py-1.5 rounded-lg bg-background/80 border border-rose-500/30 text-xs text-foreground"
                                >
                                    <span className="font-medium text-foreground">{a.product_name}</span>
                                    {" "}
                                    ({parseFloat(parseNum(a.current_stock)).toLocaleString("en-IN")} {a.uom || "EA"} {" < "} {parseFloat(parseNum(a.reorder_point)).toLocaleString("en-IN")})
                                </span>
                            ))}
                            {lowStockAlerts.length > 8 && (
                                <span className="px-3 py-1.5 text-xs text-muted-foreground">+{lowStockAlerts.length - 8} more</span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Stock levels */}
            <div className="bg-card/60 backdrop-blur-md border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-border flex flex-col gap-4 bg-card">
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search by product name or SKU..."
                            value={searchStock}
                            onChange={(e) => setSearchStock(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all text-sm text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewStockMode("total")}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${viewStockMode === "total" ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40" : "bg-secondary/50 text-secondary-foreground hover:bg-secondary border-border"}`}
                        >
                            <Package className="w-4 h-4 inline mr-1.5 align-middle" />
                            Total
                        </button>
                        <button
                            onClick={() => setViewStockMode("by_warehouse")}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${viewStockMode === "by_warehouse" ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40" : "bg-secondary/50 text-secondary-foreground hover:bg-secondary border-border"}`}
                        >
                            <Layers className="w-4 h-4 inline mr-1.5 align-middle" />
                            By warehouse
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    {viewStockMode === "total" ? (
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-muted/50 border-b border-border">
                                <tr>
                                    <th className="px-6 py-4 font-semibold text-foreground">Product</th>
                                    <th className="px-6 py-4 font-semibold text-foreground">SKU</th>
                                    <th className="px-6 py-4 text-right font-semibold text-foreground">Total Stock</th>
                                    <th className="px-6 py-4 text-right font-semibold text-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-foreground">
                                {loading ? (
                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
                                ) : filteredStock.length === 0 ? (
                                    <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">No products or stock data.</td></tr>
                                ) : (
                                    filteredStock.map((s) => (
                                        <tr
                                            key={s.product_id}
                                            className="hover:bg-muted/40 transition-colors cursor-pointer"
                                            onClick={() => openDetail(s.product_id)}
                                        >
                                            <td className="px-6 py-4 font-medium text-foreground">{s.product_name}</td>
                                            <td className="px-6 py-4"><span className="font-mono text-xs bg-muted px-2 py-1 rounded text-foreground">{s.product_sku}</span></td>
                                            <td className="px-6 py-4 text-right font-medium text-amber-600 dark:text-amber-400">
                                                {parseFloat(parseNum(s.total_stock)).toLocaleString("en-IN")}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                                                    onClick={(e) => { e.stopPropagation(); openDetail(s.product_id); }}
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-muted/50 border-b border-border">
                                <tr>
                                    <th className="px-6 py-4 font-semibold text-foreground">Product</th>
                                    <th className="px-6 py-4 font-semibold text-foreground">SKU</th>
                                    <th className="px-6 py-4 font-semibold text-foreground">Warehouse</th>
                                    <th className="px-6 py-4 text-right font-semibold text-foreground">Quantity</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-foreground">
                                {loading ? (
                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
                                ) : stockByWarehouse.filter((r) => {
                                            const q = parseFloat(parseNum(r.quantity));
                                            if (q !== 0) return true;
                                            const term = searchStock.toLowerCase();
                                            return r.product_name.toLowerCase().includes(term) || r.product_sku.toLowerCase().includes(term);
                                        }).length === 0 ? (
                                    <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">No stock by warehouse. Record movements to see breakdown.</td></tr>
                                ) : (
                                    stockByWarehouse
                                        .filter((r) => {
                                            const q = parseFloat(parseNum(r.quantity));
                                            if (q !== 0) return true;
                                            const term = searchStock.toLowerCase();
                                            return r.product_name.toLowerCase().includes(term) || r.product_sku.toLowerCase().includes(term);
                                        })
                                        .map((r) => (
                                            <tr
                                                key={`${r.product_id}-${r.warehouse_id}`}
                                                className="hover:bg-muted/40 transition-colors cursor-pointer"
                                                onClick={() => openDetail(r.product_id, r.warehouse_id)}
                                            >
                                                <td className="px-6 py-4 font-medium text-foreground">{r.product_name}</td>
                                                <td className="px-6 py-4"><span className="font-mono text-xs bg-muted px-2 py-1 rounded text-foreground">{r.product_sku}</span></td>
                                                <td className="px-6 py-4 text-foreground">{r.warehouse_name}</td>
                                                <td className="px-6 py-4 text-right font-medium text-amber-600 dark:text-amber-400">
                                                    {parseFloat(parseNum(r.quantity)).toLocaleString("en-IN")}
                                                </td>
                                            </tr>
                                        ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
                </div>
            </div>

            {/* Warehouses */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card/60 backdrop-blur-md border border-border rounded-2xl shadow-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-border bg-card">
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <WarehouseIcon className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                                Warehouses
                            </h2>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search warehouses..."
                                value={searchWarehouse}
                                onChange={(e) => setSearchWarehouse(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                    </div>
                    <div className="p-4 max-h-56 overflow-y-auto">
                        {filteredWarehouses.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4">{warehouses.length === 0 ? "No warehouses yet." : "No warehouses match your search."}</p>
                        ) : (
                            <ul className="space-y-2">
                                {filteredWarehouses.map((w) => (
                                    <li
                                        key={w.id}
                                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40 border border-border hover:bg-muted/60 transition-colors"
                                    >
                                        <div>
                                            <span className="font-medium text-foreground">{w.name}</span>
                                            {w.location && (
                                                <span className="text-muted-foreground text-xs block">
                                                    {w.location}
                                                </span>
                                            )}
                                        </div>
                                        <button className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted" aria-label="More">
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Recent transactions / Stock ledger */}
                <div className="bg-card/60 backdrop-blur-md border border-border rounded-2xl shadow-xl overflow-hidden">
                    <div className="p-4 border-b border-border bg-card space-y-3">
                        <div className="flex items-center gap-2 text-foreground font-semibold">
                            <ClipboardList className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                            Stock ledger
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                            <div className="relative flex-1 min-w-[140px] max-w-xs">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search ledger..."
                                    value={searchTx}
                                    onChange={(e) => setSearchTx(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground placeholder:text-muted-foreground"
                                />
                            </div>
                            <div className="flex gap-1">
                                {(["ALL", "IN", "OUT", "ADJUSTMENT"] as const).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setTxTypeFilter(type)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${txTypeFilter === type ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40" : "bg-secondary/50 text-secondary-foreground hover:bg-secondary border-border"}`}
                                    >
                                        {type === "ALL" ? "All" : type}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto max-h-56 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50 border-b border-border sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 font-semibold text-foreground">Product</th>
                                    <th className="px-4 py-2 font-semibold text-foreground">Warehouse</th>
                                    <th className="px-4 py-2 font-semibold text-foreground">Type</th>
                                    <th className="px-4 py-2 text-right font-semibold text-foreground">Qty</th>
                                    <th className="px-4 py-2 font-semibold text-foreground">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-foreground">
                                {filteredTx.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                                            No transactions yet.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTx.slice(0, 20).map((t) => {
                                        const p = productById(t.product_id);
                                        const w = warehouseById(t.warehouse_id);
                                        return (
                                            <tr key={t.id} className="hover:bg-muted/40">
                                                <td className="px-4 py-2 font-medium text-foreground">
                                                    {p?.name ?? t.product_id.slice(0, 8)}
                                                </td>
                                                <td className="px-4 py-2 text-foreground">{w?.name ?? "-"}</td>
                                                <td className="px-4 py-2">
                                                    {t.transaction_type === "IN" ? (
                                                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                            <ArrowDownToLine className="w-3.5 h-3.5" />
                                                            IN
                                                        </span>
                                                    ) : t.transaction_type === "OUT" ? (
                                                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                                            <ArrowUpFromLine className="w-3.5 h-3.5" />
                                                            OUT
                                                        </span>
                                                    ) : (
                                                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">ADJ</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-right text-foreground">
                                                    {t.transaction_type === "OUT" ? "-" : ""}
                                                    {parseFloat(parseNum(t.quantity)).toLocaleString("en-IN")}
                                                </td>
                                                <td className="px-4 py-2 text-muted-foreground text-xs">
                                                    {new Date(t.created_at).toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Transfers */}
            <div className="bg-card/60 backdrop-blur-md border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-card space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <Truck className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                            Warehouse transfers
                        </h2>
                        <button onClick={() => { setShowTransferModal(true); setNewTransfer({ from_warehouse_id: "", to_warehouse_id: "", product_id: "", quantity: "", notes: "" }); }} className="text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300">+ New transfer</button>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="relative flex-1 min-w-[140px] max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search by warehouse or product..."
                                value={searchTransfer}
                                onChange={(e) => setSearchTransfer(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                        <div className="flex gap-1">
                            {(["ALL", "PENDING", "COMPLETED"] as const).map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setTransferStatusFilter(status)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${transferStatusFilter === status ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40" : "bg-secondary/50 text-secondary-foreground hover:bg-secondary border-border"}`}
                                >
                                    {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50 border-b border-border sticky top-0">
                            <tr>
                                <th className="px-4 py-2 font-semibold text-foreground">From → To</th>
                                <th className="px-4 py-2 font-semibold text-foreground">Product</th>
                                <th className="px-4 py-2 text-right font-semibold text-foreground">Qty</th>
                                <th className="px-4 py-2 font-semibold text-foreground">Status</th>
                                <th className="px-4 py-2 text-right font-semibold text-foreground">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border text-foreground">
                            {filteredTransfers.length === 0 ? (
                                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">{transfers.length === 0 ? "No transfers. Create one to move stock between warehouses." : "No transfers match your filters."}</td></tr>
                            ) : (
                                filteredTransfers.map((tr) => {
                                    const fromWh = warehouseById(tr.from_warehouse_id);
                                    const toWh = warehouseById(tr.to_warehouse_id);
                                    const prod = productById(tr.product_id);
                                    return (
                                        <tr key={tr.id} className="hover:bg-muted/40">
                                            <td className="px-4 py-2 font-medium text-foreground">{fromWh?.name ?? "-"} → {toWh?.name ?? "-"}</td>
                                            <td className="px-4 py-2 text-foreground">{prod?.name ?? tr.product_id.slice(0, 8)}</td>
                                            <td className="px-4 py-2 text-right">{parseFloat(parseNum(tr.quantity)).toLocaleString("en-IN")}</td>
                                            <td className="px-4 py-2">
                                                <span className={tr.status === "COMPLETED" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>{tr.status}</span>
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                {tr.status !== "COMPLETED" && (
                                                    <button
                                                        onClick={() => completeTransfer(tr.id)}
                                                        disabled={completingTransferId === tr.id}
                                                        className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 text-xs font-medium disabled:opacity-50"
                                                    >
                                                        {completingTransferId === tr.id ? "..." : "Complete"}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Reservations */}
            {reservations.length > 0 && (
                <div className="bg-card/60 backdrop-blur-md border border-border rounded-2xl shadow-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-border bg-card space-y-3">
                        <h2 className="text-lg font-semibold text-foreground">Reservations</h2>
                        <div className="relative max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search by product or warehouse..."
                                value={searchReservation}
                                onChange={(e) => setSearchReservation(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto max-h-40 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50 border-b border-border">
                                <tr>
                                    <th className="px-4 py-2 font-semibold text-foreground">Product</th>
                                    <th className="px-4 py-2 font-semibold text-foreground">Warehouse</th>
                                    <th className="px-4 py-2 text-right font-semibold text-foreground">Qty</th>
                                    <th className="px-4 py-2 font-semibold text-foreground">Reference</th>
                                    <th className="px-4 py-2 font-semibold text-foreground">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-foreground">
                                {filteredReservations.length === 0 ? (
                                    <tr><td colSpan={5} className="px-4 py-4 text-center text-muted-foreground">No reservations match your search.</td></tr>
                                ) : (
                                    filteredReservations.map((r) => (
                                        <tr key={r.id} className="hover:bg-muted/40">
                                            <td className="px-4 py-2 font-medium text-foreground">{productById(r.product_id)?.name ?? r.product_id.slice(0, 8)}</td>
                                            <td className="px-4 py-2 text-foreground">{warehouseById(r.warehouse_id)?.name ?? "-"}</td>
                                            <td className="px-4 py-2 text-right">{parseFloat(parseNum(r.quantity)).toLocaleString("en-IN")}</td>
                                            <td className="px-4 py-2 text-muted-foreground text-xs">{r.reference_type}</td>
                                            <td className="px-4 py-2"><span className="text-amber-600 dark:text-amber-400">{r.status}</span></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Add Warehouse modal */}
            {showWarehouseModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/40">
                            <h3 className="text-lg font-semibold text-foreground">New Warehouse</h3>
                            <button
                                onClick={() => setShowWarehouseModal(false)}
                                className="text-foreground/70 hover:text-foreground text-xl leading-none p-1 rounded hover:bg-muted"
                            >
                                &times;
                            </button>
                        </div>
                        <form onSubmit={createWarehouse} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground/80">Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newWarehouse.name}
                                    onChange={(e) =>
                                        setNewWarehouse({ ...newWarehouse, name: e.target.value })
                                    }
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground"
                                    placeholder="e.g. Main Store"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground/80">Location</label>
                                <input
                                    type="text"
                                    value={newWarehouse.location}
                                    onChange={(e) =>
                                        setNewWarehouse({ ...newWarehouse, location: e.target.value })
                                    }
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground"
                                    placeholder="e.g. Building A, Floor 1"
                                />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowWarehouseModal(false)}
                                    className="px-4 py-2 text-sm text-foreground/70 hover:text-foreground transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl shadow-lg transition-colors"
                                >
                                    Save Warehouse
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Record movement modal */}
            {showTransactionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/40">
                            <h3 className="text-lg font-semibold text-foreground">Record Stock Movement</h3>
                            <button
                                onClick={() => setShowTransactionModal(false)}
                                className="text-foreground/70 hover:text-foreground text-xl leading-none p-1 rounded hover:bg-muted"
                            >
                                &times;
                            </button>
                        </div>
                        <form onSubmit={recordTransaction} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground/80">Product</label>
                                <select
                                    required
                                    value={newTransaction.product_id}
                                    onChange={(e) =>
                                        setNewTransaction({
                                            ...newTransaction,
                                            product_id: e.target.value,
                                        })
                                    }
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground"
                                >
                                    <option value="">Select product</option>
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.sku})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground/80">Warehouse</label>
                                <select
                                    required
                                    value={newTransaction.warehouse_id}
                                    onChange={(e) =>
                                        setNewTransaction({
                                            ...newTransaction,
                                            warehouse_id: e.target.value,
                                        })
                                    }
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground"
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
                                <label className="text-xs font-medium text-foreground/80">Type</label>
                                <div className="flex gap-3 flex-wrap">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="type" checked={newTransaction.transaction_type === "IN"} onChange={() => setNewTransaction({ ...newTransaction, transaction_type: "IN" })} className="text-amber-500 focus:ring-amber-500" />
                                        <span className="text-emerald-600 dark:text-emerald-400">IN</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="type" checked={newTransaction.transaction_type === "OUT"} onChange={() => setNewTransaction({ ...newTransaction, transaction_type: "OUT" })} className="text-amber-500 focus:ring-amber-500" />
                                        <span className="text-rose-600 dark:text-rose-400">OUT</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="type" checked={newTransaction.transaction_type === "ADJUSTMENT"} onChange={() => setNewTransaction({ ...newTransaction, transaction_type: "ADJUSTMENT" })} className="text-amber-500 focus:ring-amber-500" />
                                        <span className="text-amber-600 dark:text-amber-400">Adjustment</span>
                                    </label>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground/80">Reason (audit)</label>
                                <select
                                    value={newTransaction.transaction_reason}
                                    onChange={(e) => setNewTransaction({ ...newTransaction, transaction_reason: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground"
                                >
                                    <option value="RECEIPT">Receipt</option>
                                    <option value="SHIPMENT">Shipment</option>
                                    <option value="ADJUSTMENT">Adjustment</option>
                                    <option value="TRANSFER">Transfer</option>
                                    <option value="RETURN">Return</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground/80">Quantity</label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    required
                                    value={newTransaction.quantity}
                                    onChange={(e) =>
                                        setNewTransaction({
                                            ...newTransaction,
                                            quantity: e.target.value,
                                        })
                                    }
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground"
                                    placeholder="e.g. 100 or 12.5"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground/80">Notes (optional)</label>
                                <textarea
                                    rows={2}
                                    value={newTransaction.notes}
                                    onChange={(e) =>
                                        setNewTransaction({
                                            ...newTransaction,
                                            notes: e.target.value,
                                        })
                                    }
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground resize-none"
                                    placeholder="Reference or reason"
                                />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowTransactionModal(false)}
                                    className="px-4 py-2 text-sm text-foreground/70 hover:text-foreground transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl shadow-lg transition-colors"
                                >
                                    Record
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Transfer modal */}
            {showTransferModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/40">
                            <h3 className="text-lg font-semibold text-foreground">New transfer</h3>
                            <button onClick={() => setShowTransferModal(false)} className="text-foreground/70 hover:text-foreground text-xl leading-none p-1 rounded hover:bg-muted">&times;</button>
                        </div>
                        <form onSubmit={createTransfer} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground/80">From warehouse</label>
                                <select required value={newTransfer.from_warehouse_id} onChange={(e) => setNewTransfer({ ...newTransfer, from_warehouse_id: e.target.value })} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground">
                                    <option value="">Select</option>
                                    {warehouses.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground/80">To warehouse</label>
                                <select required value={newTransfer.to_warehouse_id} onChange={(e) => setNewTransfer({ ...newTransfer, to_warehouse_id: e.target.value })} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground">
                                    <option value="">Select</option>
                                    {warehouses.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground/80">Product</label>
                                <select required value={newTransfer.product_id} onChange={(e) => setNewTransfer({ ...newTransfer, product_id: e.target.value })} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground">
                                    <option value="">Select</option>
                                    {products.map((p) => (<option key={p.id} value={p.id}>{p.name} ({p.sku})</option>))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground/80">Quantity</label>
                                <input type="text" inputMode="decimal" required value={newTransfer.quantity} onChange={(e) => setNewTransfer({ ...newTransfer, quantity: e.target.value })} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground" placeholder="e.g. 100" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground/80">Notes (optional)</label>
                                <input type="text" value={newTransfer.notes} onChange={(e) => setNewTransfer({ ...newTransfer, notes: e.target.value })} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground" placeholder="Reference" />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowTransferModal(false)} className="px-4 py-2 text-sm text-foreground/70 hover:text-foreground transition-colors">Cancel</button>
                                <button type="submit" className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl shadow-lg transition-colors">Create transfer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Batch modal */}
            {showBatchModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/40">
                            <h3 className="text-lg font-semibold text-foreground">New batch / lot</h3>
                            <button onClick={() => setShowBatchModal(false)} className="text-foreground/70 hover:text-foreground text-xl leading-none p-1 rounded hover:bg-muted">&times;</button>
                        </div>
                        <form onSubmit={createBatch} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground/80">Product</label>
                                <select required value={newBatch.product_id} onChange={handleBatchProductChange} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground">
                                    <option value="">Select</option>
                                    {products.map((p) => (<option key={p.id} value={p.id}>{p.name} ({p.sku})</option>))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground/80">Batch number</label>
                                <input type="text" required value={newBatch.batch_number} onChange={(e) => setNewBatch({ ...newBatch, batch_number: e.target.value })} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground font-mono" placeholder="e.g. BATCH-2024-001" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground/80">Mfg date</label>
                                    <input type="date" value={newBatch.manufacture_date} onChange={(e) => setNewBatch({ ...newBatch, manufacture_date: e.target.value })} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground/80">Expiry date</label>
                                    <input type="date" value={newBatch.expiry_date} onChange={(e) => setNewBatch({ ...newBatch, expiry_date: e.target.value })} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm text-foreground" />
                                </div>
                            </div>
                            {batchesForProduct.length > 0 && (
                                <div className="text-xs text-foreground/80">Existing batches: {batchesForProduct.map((b) => b.batch_number).join(", ")}</div>
                            )}
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowBatchModal(false)} className="px-4 py-2 text-sm text-foreground/70 hover:text-foreground transition-colors">Cancel</button>
                                <button type="submit" className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl shadow-lg transition-colors">Create batch</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail drawer */}
            {detailOpen && (
                <div className="fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/60" onClick={closeDetail} />
                    <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-card border-l border-border shadow-2xl overflow-y-auto">
                        <div className="p-5 border-b border-border flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="text-xs text-muted-foreground mb-1">Inventory detail</div>
                                <div className="text-lg font-semibold text-foreground truncate">
                                    {detailProductId ? productById(detailProductId)?.name ?? "Product" : "Product"}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    SKU:{" "}
                                    <span className="font-mono">
                                        {detailProductId ? productById(detailProductId)?.sku ?? "—" : "—"}
                                    </span>
                                    {detailWarehouseId && (
                                        <>
                                            <span className="mx-2 text-muted-foreground">·</span>
                                            Warehouse:{" "}
                                            <span className="font-medium text-foreground">
                                                {warehouseById(detailWarehouseId)?.name ?? "—"}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={closeDetail}
                                className="text-foreground/70 hover:text-foreground text-xl leading-none p-1 rounded hover:bg-muted"
                                aria-label="Close"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="p-5 space-y-6">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl border border-border bg-muted/20 p-3">
                                    <div className="text-xs text-muted-foreground">Unit price</div>
                                    <div className="text-sm font-semibold text-foreground">
                                        ₹{parseFloat(parseNum(detailProductId ? productById(detailProductId)?.price : 0)).toLocaleString("en-IN")}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-border bg-muted/20 p-3">
                                    <div className="text-xs text-muted-foreground">Scope</div>
                                    <div className="text-sm font-semibold text-foreground">
                                        {detailWarehouseId ? "Warehouse ledger" : "Global ledger"}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-foreground">Recent movements (ledger)</h3>
                                    <span className="text-xs text-muted-foreground">Last 50</span>
                                </div>
                                <div className="rounded-2xl border border-border overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-muted/50 border-b border-border">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold text-foreground">Type</th>
                                                <th className="px-4 py-3 text-right font-semibold text-foreground">Qty</th>
                                                <th className="px-4 py-3 font-semibold text-foreground">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {detailLoading ? (
                                                <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Loading...</td></tr>
                                            ) : detailTransactions.length === 0 ? (
                                                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No movements found.</td></tr>
                                            ) : (
                                                detailTransactions.slice(0, 50).map((t) => (
                                                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                                                        <td className="px-4 py-3 font-medium text-foreground">{t.transaction_type}</td>
                                                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                                                            {parseFloat(parseNum(t.quantity)).toLocaleString("en-IN")}
                                                        </td>
                                                        <td className="px-4 py-3 text-muted-foreground">
                                                            {t.created_at ? new Date(t.created_at).toLocaleString("en-IN") : "—"}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-foreground">Batches</h3>
                                    <span className="text-xs text-muted-foreground">{detailBatches.length}</span>
                                </div>
                                <div className="rounded-2xl border border-border overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-muted/50 border-b border-border">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold text-foreground">Batch</th>
                                                <th className="px-4 py-3 font-semibold text-foreground">Mfg</th>
                                                <th className="px-4 py-3 font-semibold text-foreground">Exp</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {detailLoading ? (
                                                <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Loading...</td></tr>
                                            ) : detailBatches.length === 0 ? (
                                                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No batches for this product.</td></tr>
                                            ) : (
                                                detailBatches.slice(0, 50).map((b) => (
                                                    <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                                                        <td className="px-4 py-3 font-mono text-xs text-foreground">{b.batch_number}</td>
                                                        <td className="px-4 py-3 text-muted-foreground">{b.manufacture_date ? new Date(b.manufacture_date).toLocaleDateString("en-IN") : "—"}</td>
                                                        <td className="px-4 py-3 text-muted-foreground">{b.expiry_date ? new Date(b.expiry_date).toLocaleDateString("en-IN") : "—"}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
