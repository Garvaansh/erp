"use client";

import { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { Plus, Search, Box, MoreVertical, Pencil, Trash2, X, AlertTriangle, FileSpreadsheet, ChevronLeft, ChevronRight, QrCode, Download } from "lucide-react";
import { ExcelUpload } from "@/components/ExcelUpload";
import { useMockData } from "@/app/(dashboard)/layout";

interface Category {
    id: string;
    name: string;
    description?: string | null;
}

interface Product {
    id: string;
    name: string;
    sku: string;
    price: string;
    category_id?: string | null;
    reorder_point?: string | number;
    safety_stock?: string | number;
    lead_time_days?: number;
    uom?: string;
    product_type?: string | null;
    stock_status?: string | null;
    tr_notes?: string | null;
    brand?: string | null;
    hsn_sac?: string | null;
    gst_rate?: string | number | null;
    created_at: string;
    updated_at?: string;
}

interface ProductForm {
    name: string;
    sku: string;
    price: string;
    reorder_point: string;
    safety_stock: string;
    lead_time_days: string;
    uom: string;
    category_id: string;
    product_type: string;
    stock_status: string;
    tr_notes: string;
    brand: string;
    hsn_sac: string;
    gst_rate: string;
}

const emptyForm: ProductForm = {
    name: "", sku: "", price: "", reorder_point: "0", safety_stock: "0", lead_time_days: "0", uom: "EA",
    category_id: "", product_type: "", stock_status: "", tr_notes: "", brand: "", hsn_sac: "", gst_rate: "",
};

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [form, setForm] = useState<ProductForm>(emptyForm);
    const [saving, setSaving] = useState(false);

    const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [showExcelImport, setShowExcelImport] = useState(false);
    const [qrProduct, setQrProduct] = useState<Product | null>(null);
    const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
    const [qrLoading, setQrLoading] = useState(false);
    const { mockData } = useMockData();
    const [totalCount, setTotalCount] = useState<number | null>(null);
    const [page, setPage] = useState(0);
    const limit = 50;
    const [categories, setCategories] = useState<Category[]>([]);
    const [categoryFilter, setCategoryFilter] = useState<string>("");

    useEffect(() => {
        if (!mockData) {
            api.get("/inventory/categories").then((r) => setCategories(Array.isArray(r.data) ? r.data : [])).catch(() => {});
        }
    }, [mockData]);

    useEffect(() => {
        setPage(0);
    }, [mockData, categoryFilter]);

    useEffect(() => {
        fetchProducts();
    }, [mockData, page, categoryFilter]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest("[data-product-menu]")) setOpenMenuId(null);
        };
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, []);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            let url: string;
            if (mockData) {
                url = `/inventory/products?limit=${limit}&offset=${page * limit}`;
            } else {
                url = categoryFilter ? `/inventory/products?category_id=${categoryFilter}` : "/inventory/products";
            }
            const res = await api.get(url);
            setProducts(Array.isArray(res.data) ? res.data : []);
            const totalHeader = res.headers?.["x-total-count"];
            const n = totalHeader != null ? parseInt(String(totalHeader), 10) : NaN;
            setTotalCount(Number.isNaN(n) ? null : n);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const categoryNameMap = useMemo(() => {
        const m: Record<string, string> = {};
        categories.forEach((c) => { m[c.id] = c.name; });
        return m;
    }, [categories]);

    const filteredProducts = useMemo(() => {
        if (!searchTerm.trim()) return products;
        const q = searchTerm.toLowerCase();
        return products.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                (p.sku && p.sku.toLowerCase().includes(q))
        );
    }, [products, searchTerm]);

    const openCreateModal = () => {
        setEditingProduct(null);
        setForm(emptyForm);
        setShowModal(true);
    };

    const openQrModal = async (p: Product) => {
        setOpenMenuId(null);
        setQrProduct(p);
        setQrImageUrl(null);
        setQrLoading(true);
        try {
            const res = await api.get(`/inventory/products/${p.id}/qrcode`, { responseType: "blob" });
            const url = URL.createObjectURL(res.data as Blob);
            setQrImageUrl(url);
        } catch (err) {
            console.error(err);
            alert("Failed to load QR code");
        } finally {
            setQrLoading(false);
        }
    };

    const closeQrModal = () => {
        if (qrImageUrl) URL.revokeObjectURL(qrImageUrl);
        setQrProduct(null);
        setQrImageUrl(null);
    };

    const openEditModal = (p: Product) => {
        setEditingProduct(p);
        setForm({
            name: p.name,
            sku: p.sku,
            price: String(p.price),
            reorder_point: p.reorder_point != null ? String(p.reorder_point) : "0",
            safety_stock: p.safety_stock != null ? String(p.safety_stock) : "0",
            lead_time_days: p.lead_time_days != null ? String(p.lead_time_days) : "0",
            uom: p.uom || "EA",
            category_id: p.category_id ?? "",
            product_type: p.product_type ?? "",
            stock_status: p.stock_status ?? "",
            tr_notes: p.tr_notes ?? "",
            brand: p.brand ?? "",
            hsn_sac: p.hsn_sac ?? "",
            gst_rate: p.gst_rate != null ? String(p.gst_rate) : "",
        });
        setOpenMenuId(null);
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.sku.trim()) {
            alert("Name and SKU are required.");
            return;
        }
        const price = parseFloat(form.price);
        if (Number.isNaN(price) || price < 0) {
            alert("Enter a valid price.");
            return;
        }
        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                sku: form.sku.trim(),
                price,
                reorder_point: parseFloat(form.reorder_point) || 0,
                safety_stock: parseFloat(form.safety_stock) || 0,
                lead_time_days: parseInt(form.lead_time_days, 10) || 0,
                uom: form.uom || "EA",
                category_id: form.category_id || null,
                product_type: form.product_type.trim() || null,
                stock_status: form.stock_status.trim() || null,
                tr_notes: form.tr_notes.trim() || null,
                brand: form.brand.trim() || null,
                hsn_sac: form.hsn_sac.trim() || null,
                gst_rate: form.gst_rate ? parseFloat(form.gst_rate) : null,
            };
            if (editingProduct) {
                await api.put(`/inventory/products/${editingProduct.id}`, payload);
            } else {
                await api.post("/inventory/products", payload);
            }
            setShowModal(false);
            setForm(emptyForm);
            setEditingProduct(null);
            fetchProducts();
        } catch (err) {
            console.error(err);
            alert(editingProduct ? "Failed to update product" : "Failed to create product");
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = (p: Product) => {
        setDeleteTarget(p);
        setOpenMenuId(null);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/inventory/products/${deleteTarget.id}`);
            setDeleteTarget(null);
            fetchProducts();
        } catch (err) {
            console.error(err);
            alert("Failed to delete product. It may be in use by orders or inventory.");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center bg-card/80 border border-border p-6 rounded-2xl shadow-xl">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                        <Box className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Product Catalog</h1>
                        <p className="text-sm text-muted-foreground">Manage Reva raw materials, components, and finished goods.</p>
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
                        onClick={openCreateModal}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                    >
                        <Plus className="w-4 h-4" />
                        Add Product
                    </button>
                </div>
            </div>

            {showExcelImport && (
                <ExcelUpload<{ name: string; sku: string; price: number; reorder_point?: number; safety_stock?: number; lead_time_days?: number; uom?: string; product_type?: string | null; stock_status?: string | null; tr_notes?: string | null; brand?: string | null }>
                    endpoint="/inventory/products/bulk"
                    templateFilename="products_template.xlsx"
                    templateHeaders={["Name", "SKU", "Price", "Reorder Point", "Safety Stock", "Lead Time Days", "UOM", "Product Type", "Stock Status", "Tr Notes", "Brand"]}
                    sampleRow={["Nitrile Gasket 5mm", "NRG-05MM", 450, 10, 5, 3, "EA", "30 MM", "In stock", "NEW", "Acme"]}
                    columnsHelp={[
                        { header: "Name", required: true, sample: "Nitrile Gasket 5mm" },
                        { header: "SKU", required: true, sample: "NRG-05MM" },
                        { header: "Price", required: true, sample: 450 },
                        { header: "Reorder Point", required: false, sample: 10 },
                        { header: "Safety Stock", required: false, sample: 5 },
                        { header: "Lead Time Days", required: false, sample: 3 },
                        { header: "UOM", required: false, sample: "EA" },
                        { header: "Product Type", required: false, sample: "30 MM" },
                        { header: "Stock Status", required: false, sample: "In stock" },
                        { header: "Tr Notes", required: false, sample: "NEW" },
                        { header: "Brand", required: false, sample: "Acme" },
                    ]}
                    mapRow={(row) => {
                        const name = String(row["Name"] ?? row["name"] ?? "").trim();
                        const sku = String(row["SKU"] ?? row["sku"] ?? "").trim();
                        if (!name || !sku) return null;
                        const price = Number(row["Price"] ?? row["price"] ?? 0) || 0;
                        return {
                            name,
                            sku,
                            price,
                            reorder_point: Number(row["Reorder Point"] ?? row["reorder_point"] ?? 0) || undefined,
                            safety_stock: Number(row["Safety Stock"] ?? row["safety_stock"] ?? 0) || undefined,
                            lead_time_days: Number(row["Lead Time Days"] ?? row["lead_time_days"] ?? 0) || undefined,
                            uom: String(row["UOM"] ?? row["uom"] ?? "EA").trim() || "EA",
                            product_type: (v => v ? String(v).trim() : null)(row["Product Type"] ?? row["product_type"]),
                            stock_status: (v => v ? String(v).trim() : null)(row["Stock Status"] ?? row["stock_status"]),
                            tr_notes: (v => v ? String(v).trim() : null)(row["Tr Notes"] ?? row["tr_notes"]),
                            brand: (v => v ? String(v).trim() : null)(row["Brand"] ?? row["brand"]),
                        };
                    }}
                    onSuccess={() => { fetchProducts(); }}
                    onClose={() => setShowExcelImport(false)}
                    title="Bulk import products"
                />
            )}

            <div className="bg-card/60 backdrop-blur-md border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-border flex flex-wrap gap-4 bg-card">
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search products by Name or SKU..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-sm text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                    {!mockData && categories.length > 0 && (
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground min-w-[180px]"
                        >
                            <option value="">All categories</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    )}
                    <div className="flex items-center text-xs text-muted-foreground">
                        {filteredProducts.length} of {products.length} products
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-muted/30 text-muted-foreground font-medium">
                            <tr>
                                <th className="px-6 py-4">Product Name</th>
                                <th className="px-6 py-4">SKU</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4">Brand</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Standard Price</th>
                                <th className="px-6 py-4">Added On</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-foreground">
                            {loading ? (
                                <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">Loading catalog…</td></tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                                    {searchTerm ? "No products match your search." : "No products found. Add a product or change the category filter."}
                                </td></tr>
                            ) : (
                                filteredProducts.map((p) => (
                                    <tr key={p.id} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-foreground">{p.name}</td>
                                        <td className="px-6 py-4 font-mono text-xs bg-black/50 rounded px-2">{p.sku}</td>
                                        <td className="px-6 py-4 text-muted-foreground">{p.category_id ? categoryNameMap[p.category_id] ?? "—" : "—"}</td>
                                        <td className="px-6 py-4 text-muted-foreground">{p.brand || "—"}</td>
                                        <td className="px-6 py-4 text-muted-foreground max-w-[100px] truncate" title={p.product_type ?? ""}>{p.product_type || "—"}</td>
                                        <td className="px-6 py-4">₹{parseFloat(String(p.price)).toLocaleString("en-IN")}</td>
                                        <td className="px-6 py-4">{new Date(p.created_at).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="relative inline-block" data-product-menu>
                                                <button
                                                    onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                                                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                                {openMenuId === p.id && (
                                                    <div className="absolute right-0 top-full mt-1 w-40 bg-[#1a1a1d] border border-border rounded-xl shadow-2xl z-20 overflow-hidden">
                                                        <button
                                                            onClick={() => openEditModal(p)}
                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 hover:text-foreground"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" /> Edit
                                                        </button>
                                                        <button
                                                            onClick={() => openQrModal(p)}
                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 hover:text-foreground"
                                                        >
                                                            <QrCode className="w-3.5 h-3.5" /> QR Code
                                                        </button>
                                                        <button
                                                            onClick={() => confirmDelete(p)}
                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" /> Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {totalCount != null && totalCount > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
                        <span className="text-xs text-muted-foreground">
                            Showing {page * limit + 1}&ndash;{Math.min(page * limit + products.length, totalCount)} of {totalCount.toLocaleString()}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-xs text-muted-foreground">Page {page + 1}</span>
                            <button
                                type="button"
                                onClick={() => setPage((p) => p + 1)}
                                disabled={page * limit + products.length >= totalCount}
                                className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-lg font-medium text-foreground">{editingProduct ? "Edit Product" : "New Product"}</h3>
                            <button onClick={() => { setShowModal(false); setEditingProduct(null); }} className="text-muted-foreground hover:text-foreground">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Product Name</label>
                                <input
                                    type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                                    placeholder="e.g. Nitrile Rubber Gasket 5mm"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">SKU Code</label>
                                <input
                                    type="text" required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-mono text-foreground"
                                    placeholder="e.g. NRG-05MM"
                                />
                            </div>
                            {categories.length > 0 && (
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Category</label>
                                    <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground">
                                        <option value="">—</option>
                                        {categories.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Brand</label>
                                    <select value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground">
                                        <option value="">—</option>
                                        <option value="RIR">RIR</option>
                                        <option value="Jindal">Jindal</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Product type</label>
                                    <input type="text" value={form.product_type} onChange={(e) => setForm({ ...form, product_type: e.target.value })} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground" placeholder="e.g. 30 MM, 48 MM" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">HSN/SAC (India)</label>
                                    <input type="text" value={form.hsn_sac} onChange={(e) => setForm({ ...form, hsn_sac: e.target.value })} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground font-mono" placeholder="e.g. 4008" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">GST rate %</label>
                                    <input type="number" step="0.01" min="0" max="100" value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: e.target.value })} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground" placeholder="e.g. 18" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Stock status</label>
                                    <input type="text" value={form.stock_status} onChange={(e) => setForm({ ...form, stock_status: e.target.value })} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground" placeholder="e.g. In stock" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Tr notes</label>
                                    <input type="text" value={form.tr_notes} onChange={(e) => setForm({ ...form, tr_notes: e.target.value })} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground" placeholder="e.g. OLD, NEW" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Standard Unit Price (₹)</label>
                                <input
                                    type="number" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                                    placeholder="e.g. 450.00"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Reorder point</label>
                                    <input type="number" min="0" step="0.01" value={form.reorder_point} onChange={(e) => setForm({ ...form, reorder_point: e.target.value })} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground" placeholder="0" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Safety stock</label>
                                    <input type="number" min="0" step="0.01" value={form.safety_stock} onChange={(e) => setForm({ ...form, safety_stock: e.target.value })} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground" placeholder="0" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Lead time (days)</label>
                                    <input type="number" min="0" value={form.lead_time_days} onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground" placeholder="0" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Unit (UOM)</label>
                                    <select value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground">
                                        <option value="EA">EA (Each)</option>
                                        <option value="KG">KG</option>
                                        <option value="L">L</option>
                                        <option value="BOX">BOX</option>
                                        <option value="M">M</option>
                                        <option value="PCS">PCS</option>
                                    </select>
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => { setShowModal(false); setEditingProduct(null); }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                                <button type="submit" disabled={saving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-70 text-white text-sm font-medium rounded-xl shadow-lg transition-colors flex items-center gap-2">
                                    {saving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {editingProduct ? "Update Product" : "Save Product"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {qrProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={closeQrModal}>
                    <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-foreground">Product QR Code</h3>
                            <button onClick={closeQrModal} className="text-muted-foreground hover:text-foreground p-1 rounded-md">&times;</button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{qrProduct.name}</p>
                        <p className="text-xs font-mono text-muted-foreground mb-4">SKU: {qrProduct.sku}</p>
                        <div className="flex justify-center bg-white rounded-xl p-4 mb-4 min-h-[200px]">
                            {qrLoading ? (
                                <div className="flex items-center justify-center w-48 h-48"><div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" /></div>
                            ) : qrImageUrl ? (
                                <img src={qrImageUrl} alt="Product QR Code" className="w-48 h-48 object-contain" />
                            ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground mb-3 text-center">Scan for inventory lookup</p>
                        {qrImageUrl && (
                            <a href={qrImageUrl} download={`qr-${qrProduct.sku || qrProduct.id}.png`} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-muted/50 hover:bg-muted border border-border rounded-xl text-sm text-foreground transition-colors">
                                <Download className="w-4 h-4" /> Download PNG
                            </a>
                        )}
                    </div>
                </div>
            )}

            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="w-7 h-7 text-red-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Product?</h3>
                            <p className="text-sm text-muted-foreground mb-6">
                                Are you sure you want to delete <span className="text-foreground font-medium">{deleteTarget.name}</span>?
                                This cannot be undone. Products in use by orders or inventory cannot be deleted.
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50">Cancel</button>
                                <button onClick={handleDelete} disabled={deleting} className="px-5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-70 text-white text-sm font-medium rounded-xl shadow-lg transition-colors flex items-center gap-2">
                                    {deleting && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
