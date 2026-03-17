"use client";

import { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import {
    Plus,
    Search,
    Users,
    MoreVertical,
    Pencil,
    Trash2,
    Mail,
    Phone,
    MapPin,
    User,
    X,
    Building2,
    AlertTriangle,
    FileText,
    FileSpreadsheet,
} from "lucide-react";
import { ExcelUpload } from "@/components/ExcelUpload";

interface Customer {
    id: string;
    name: string;
    contact_person: string | null;
    email: string | null;
    phone: string | null;
    billing_address: string | null;
    shipping_address: string | null;
    tax_id: string | null;
    gstin: string | null;
    place_of_supply_state: string | null;
    pan: string | null;
    created_at: string;
    updated_at: string;
}

interface CustomerForm {
    name: string;
    contact_person: string;
    email: string;
    phone: string;
    billing_address: string;
    shipping_address: string;
    tax_id: string;
    gstin: string;
    place_of_supply_state: string;
    pan: string;
}

const emptyForm: CustomerForm = {
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    billing_address: "",
    shipping_address: "",
    tax_id: "",
    gstin: "",
    place_of_supply_state: "",
    pan: "",
};

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [form, setForm] = useState<CustomerForm>(emptyForm);
    const [saving, setSaving] = useState(false);

    const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [showExcelImport, setShowExcelImport] = useState(false);

    useEffect(() => {
        fetchCustomers();
    }, []);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest("[data-customer-menu]")) setOpenMenuId(null);
        };
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, []);

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const res = await api.get("/sales/customers");
            setCustomers(res.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const filteredCustomers = useMemo(() => {
        if (!searchTerm.trim()) return customers;
        const q = searchTerm.toLowerCase();
        return customers.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                (c.contact_person && c.contact_person.toLowerCase().includes(q)) ||
                (c.email && c.email.toLowerCase().includes(q)) ||
                (c.phone && c.phone.includes(q)) ||
                (c.tax_id && c.tax_id.toLowerCase().includes(q)) ||
                (c.gstin && c.gstin.toLowerCase().includes(q)) ||
                (c.pan && c.pan.toLowerCase().includes(q))
        );
    }, [customers, searchTerm]);

    const openCreateModal = () => {
        setEditingCustomer(null);
        setForm(emptyForm);
        setShowModal(true);
    };

    const openEditModal = (customer: Customer) => {
        setEditingCustomer(customer);
        setForm({
            name: customer.name,
            contact_person: customer.contact_person || "",
            email: customer.email || "",
            phone: customer.phone || "",
            billing_address: customer.billing_address || "",
            shipping_address: customer.shipping_address || "",
            tax_id: customer.tax_id || "",
            gstin: customer.gstin || "",
            place_of_supply_state: customer.place_of_supply_state || "",
            pan: customer.pan || "",
        });
        setOpenMenuId(null);
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                name: form.name,
                contact_person: form.contact_person || null,
                email: form.email || null,
                phone: form.phone || null,
                billing_address: form.billing_address || null,
                shipping_address: form.shipping_address || null,
                tax_id: form.tax_id || null,
                gstin: form.gstin || null,
                place_of_supply_state: form.place_of_supply_state || null,
                pan: form.pan || null,
            };
            if (editingCustomer) {
                await api.put(`/sales/customers/${editingCustomer.id}`, payload);
            } else {
                await api.post("/sales/customers", payload);
            }
            setShowModal(false);
            setForm(emptyForm);
            setEditingCustomer(null);
            fetchCustomers();
        } catch (err) {
            console.error(err);
            alert(editingCustomer ? "Failed to update customer" : "Failed to create customer");
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = (customer: Customer) => {
        setDeleteTarget(customer);
        setOpenMenuId(null);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/sales/customers/${deleteTarget.id}`);
            setDeleteTarget(null);
            fetchCustomers();
        } catch (err) {
            console.error(err);
            alert("Failed to delete customer. It may have associated orders or invoices.");
        } finally {
            setDeleting(false);
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center bg-card/80 border border-border p-6 rounded-2xl shadow-xl">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center border border-violet-500/20">
                        <Users className="w-6 h-6 text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Customers</h1>
                        <p className="text-sm text-muted-foreground">Manage customer accounts, contacts, and billing.</p>
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
                        className="bg-violet-600 hover:bg-violet-500 text-foreground text-sm font-medium py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                    >
                        <Plus className="w-4 h-4" />
                        Add Customer
                    </button>
                </div>
            </div>

            {showExcelImport && (
                <ExcelUpload<{ name: string; contact_person?: string | null; email?: string | null; phone?: string | null; billing_address?: string | null; shipping_address?: string | null; tax_id?: string | null; gstin?: string | null; place_of_supply_state?: string | null; pan?: string | null }>
                    endpoint="/sales/customers/bulk"
                    templateFilename="customers_template.xlsx"
                    templateHeaders={["Name", "Contact Person", "Email", "Phone", "Billing Address", "Shipping Address", "Tax ID", "GSTIN", "Place of Supply", "PAN"]}
                    sampleRow={["ABC Industries", "John Doe", "john@abc.com", "9876543210", "123 Main St, City", "123 Main St, City", "29AABCT1234L1Z5", "29AABCT1234L1ZM", "23", "AABCT1234L"]}
                    columnsHelp={[
                        { header: "Name", required: true, sample: "ABC Industries" },
                        { header: "Contact Person", required: false, sample: "John Doe" },
                        { header: "Email", required: false, sample: "john@abc.com" },
                        { header: "Phone", required: false, sample: "9876543210" },
                        { header: "Billing Address", required: false, sample: "123 Main St, City" },
                        { header: "Shipping Address", required: false, sample: "123 Main St, City" },
                        { header: "Tax ID", required: false, sample: "29AABCT1234L1Z5" },
                        { header: "GSTIN", required: false, sample: "29AABCT1234L1ZM" },
                        { header: "Place of Supply", required: false, sample: "23" },
                        { header: "PAN", required: false, sample: "AABCT1234L" },
                    ]}
                    mapRow={(row) => {
                        const name = String(row["Name"] ?? row["name"] ?? "").trim();
                        if (!name) return null;
                        const str = (key: string) => (v: unknown) => (v != null && String(v).trim() !== "" ? String(v).trim() : null);
                        return {
                            name,
                            contact_person: str("Contact Person")(row["Contact Person"] ?? row["contact_person"]),
                            email: str("Email")(row["Email"] ?? row["email"]),
                            phone: str("Phone")(row["Phone"] ?? row["phone"]),
                            billing_address: str("Billing Address")(row["Billing Address"] ?? row["billing_address"]),
                            shipping_address: str("Shipping Address")(row["Shipping Address"] ?? row["shipping_address"]),
                            tax_id: str("Tax ID")(row["Tax ID"] ?? row["tax_id"]),
                            gstin: str("GSTIN")(row["GSTIN"] ?? row["gstin"]),
                            place_of_supply_state: str("Place of Supply")(row["Place of Supply"] ?? row["place_of_supply_state"]),
                            pan: str("PAN")(row["PAN"] ?? row["pan"]),
                        };
                    }}
                    onSuccess={() => fetchCustomers()}
                    onClose={() => setShowExcelImport(false)}
                    title="Bulk import customers"
                />
            )}

            <div className="grid grid-cols-3 gap-4">
                <div className="bg-card/60 border border-border rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-foreground">{customers.length}</p>
                        <p className="text-xs text-muted-foreground">Total Customers</p>
                    </div>
                </div>
                <div className="bg-card/60 border border-border rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Mail className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-foreground">{customers.filter((c) => c.email).length}</p>
                        <p className="text-xs text-muted-foreground">With Email</p>
                    </div>
                </div>
                <div className="bg-card/60 border border-border rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <Phone className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-foreground">{customers.filter((c) => c.phone).length}</p>
                        <p className="text-xs text-muted-foreground">With Phone</p>
                    </div>
                </div>
            </div>

            <div className="bg-card/60 backdrop-blur-md border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-border flex gap-4 bg-card">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by name, contact, email, phone, tax ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all text-sm text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground">
                        {filteredCustomers.length} of {customers.length} customers
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-muted/30 text-muted-foreground font-medium">
                            <tr>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Phone</th>
                                <th className="px-6 py-4">Tax ID / GSTIN</th>
                                <th className="px-6 py-4">Place of supply</th>
                                <th className="px-6 py-4">Since</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-foreground">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                                            Loading customers...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                                                <Users className="w-6 h-6 text-muted-foreground" />
                                            </div>
                                            <p className="text-muted-foreground">
                                                {searchTerm ? "No customers match your search." : "No customers yet. Add your first customer."}
                                            </p>
                                            {!searchTerm && (
                                                <button onClick={openCreateModal} className="text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors">
                                                    + Add Customer
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredCustomers.map((c) => (
                                    <tr key={c.id} className="hover:bg-muted/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-300">
                                                    {getInitials(c.name)}
                                                </div>
                                                <span className="font-medium text-foreground">{c.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {c.contact_person ? (
                                                <div className="flex items-center gap-1.5">
                                                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                                                    {c.contact_person}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {c.email ? (
                                                <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors">
                                                    <Mail className="w-3.5 h-3.5" />
                                                    {c.email}
                                                </a>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {c.phone ? (
                                                <div className="flex items-center gap-1.5">
                                                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                                    {c.phone}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {c.gstin ? (
                                                <span className="font-mono text-xs bg-black/50 rounded px-2" title={c.tax_id || undefined}>{c.gstin}</span>
                                            ) : c.tax_id ? (
                                                <span className="font-mono text-xs bg-black/50 rounded px-2">{c.tax_id}</span>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground text-xs">
                                            {c.place_of_supply_state || "—"}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground text-xs">
                                            {new Date(c.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="relative inline-block" data-customer-menu>
                                                <button
                                                    onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                                                    className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                                {openMenuId === c.id && (
                                                    <div className="absolute right-0 top-full mt-1 w-40 bg-[#1a1a1d] border border-border rounded-xl shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                                        <button
                                                            onClick={() => openEditModal(c)}
                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => confirmDelete(c)}
                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            Delete
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
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30 sticky top-0 z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                                    <Users className="w-4 h-4 text-violet-400" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground">{editingCustomer ? "Edit Customer" : "New Customer"}</h3>
                            </div>
                            <button
                                onClick={() => { setShowModal(false); setEditingCustomer(null); }}
                                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5" /> Company / Customer Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm text-foreground placeholder:text-muted-foreground"
                                    placeholder="e.g. ABC Industries Ltd"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5" /> Contact Person
                                </label>
                                <input
                                    type="text"
                                    value={form.contact_person}
                                    onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm text-foreground placeholder:text-muted-foreground"
                                    placeholder="e.g. John Doe"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                        <Mail className="w-3.5 h-3.5" /> Email
                                    </label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm text-foreground placeholder:text-muted-foreground"
                                        placeholder="customer@example.com"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                        <Phone className="w-3.5 h-3.5" /> Phone
                                    </label>
                                    <input
                                        type="text"
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm text-foreground placeholder:text-muted-foreground"
                                        placeholder="+91 9876543210"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5" /> Billing Address
                                </label>
                                <textarea
                                    rows={2}
                                    value={form.billing_address}
                                    onChange={(e) => setForm({ ...form, billing_address: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm text-foreground placeholder:text-muted-foreground resize-none"
                                    placeholder="Street, City, State, PIN"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5" /> Shipping Address
                                </label>
                                <textarea
                                    rows={2}
                                    value={form.shipping_address}
                                    onChange={(e) => setForm({ ...form, shipping_address: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm text-foreground placeholder:text-muted-foreground resize-none"
                                    placeholder="Same as billing or different address"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                        <FileText className="w-3.5 h-3.5" /> Tax ID / PAN
                                    </label>
                                    <input
                                        type="text"
                                        value={form.tax_id}
                                        onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm font-mono text-foreground placeholder:text-muted-foreground"
                                        placeholder="e.g. AABCT1234L"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">GSTIN (India)</label>
                                    <input
                                        type="text"
                                        value={form.gstin}
                                        onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm font-mono text-foreground placeholder:text-muted-foreground"
                                        placeholder="e.g. 29AABCT1234L1ZM"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Place of supply (state code)</label>
                                <input
                                    type="text"
                                    value={form.place_of_supply_state}
                                    onChange={(e) => setForm({ ...form, place_of_supply_state: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm text-foreground placeholder:text-muted-foreground"
                                    placeholder="e.g. 23 for MP"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">PAN (optional)</label>
                                <input
                                    type="text"
                                    value={form.pan}
                                    onChange={(e) => setForm({ ...form, pan: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm font-mono text-foreground placeholder:text-muted-foreground"
                                    placeholder="e.g. AABCT1234L"
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); setEditingCustomer(null); }}
                                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:cursor-not-allowed text-foreground text-sm font-medium rounded-xl shadow-lg transition-colors flex items-center gap-2"
                                >
                                    {saving && (
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    )}
                                    {editingCustomer ? "Update Customer" : "Save Customer"}
                                </button>
                            </div>
                        </form>
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
                            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Customer?</h3>
                            <p className="text-sm text-muted-foreground mb-6">
                                Are you sure you want to delete <span className="text-foreground font-medium">{deleteTarget.name}</span>?
                                This cannot be undone. Customers with existing orders or invoices cannot be deleted.
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="px-5 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl shadow-lg transition-colors flex items-center gap-2"
                                >
                                    {deleting && (
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    )}
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
