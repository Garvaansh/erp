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
    FileSpreadsheet,
} from "lucide-react";
import { ExcelUpload } from "@/components/ExcelUpload";

interface Vendor {
    id: string;
    name: string;
    contact_person: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    status_notes: string | null;
    gstin: string | null;
    pan: string | null;
    created_at: string;
    updated_at: string;
}

interface VendorForm {
    name: string;
    contact_person: string;
    email: string;
    phone: string;
    address: string;
    status_notes: string;
    gstin: string;
    pan: string;
}

const emptyForm: VendorForm = {
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    status_notes: "",
    gstin: "",
    pan: "",
};

export default function VendorsPage() {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
    const [form, setForm] = useState<VendorForm>(emptyForm);
    const [saving, setSaving] = useState(false);

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Dropdown menu
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [showExcelImport, setShowExcelImport] = useState(false);

    useEffect(() => {
        fetchVendors();
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest("[data-vendor-menu]")) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, []);

    const fetchVendors = async () => {
        try {
            setLoading(true);
            const res = await api.get("/purchase/vendors");
            setVendors(res.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const filteredVendors = useMemo(() => {
        if (!searchTerm.trim()) return vendors;
        const q = searchTerm.toLowerCase();
        return vendors.filter(
            (v) =>
                v.name.toLowerCase().includes(q) ||
                (v.contact_person && v.contact_person.toLowerCase().includes(q)) ||
                (v.email && v.email.toLowerCase().includes(q)) ||
                (v.phone && v.phone.includes(q))
        );
    }, [vendors, searchTerm]);

    const openCreateModal = () => {
        setEditingVendor(null);
        setForm(emptyForm);
        setShowModal(true);
    };

    const openEditModal = (vendor: Vendor) => {
        setEditingVendor(vendor);
        setForm({
            name: vendor.name,
            contact_person: vendor.contact_person || "",
            email: vendor.email || "",
            phone: vendor.phone || "",
            address: vendor.address || "",
            status_notes: vendor.status_notes || "",
            gstin: vendor.gstin || "",
            pan: vendor.pan || "",
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
                address: form.address || null,
                status_notes: form.status_notes || null,
                gstin: form.gstin || null,
                pan: form.pan || null,
            };

            if (editingVendor) {
                await api.put(`/purchase/vendors/${editingVendor.id}`, payload);
            } else {
                await api.post("/purchase/vendors", payload);
            }
            setShowModal(false);
            setForm(emptyForm);
            setEditingVendor(null);
            fetchVendors();
        } catch (err) {
            console.error(err);
            alert(editingVendor ? "Failed to update vendor" : "Failed to create vendor");
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = (vendor: Vendor) => {
        setDeleteTarget(vendor);
        setOpenMenuId(null);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/purchase/vendors/${deleteTarget.id}`);
            setDeleteTarget(null);
            fetchVendors();
        } catch (err) {
            console.error(err);
            alert("Failed to delete vendor. It may have associated purchase orders.");
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
            {/* Header */}
            <div className="flex justify-between items-center bg-card/80 border border-border p-6 rounded-2xl shadow-xl">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                        <Users className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
                            Vendor Directory
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Manage suppliers, contact details, and vendor relationships.
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
                        id="add-vendor-btn"
                        onClick={openCreateModal}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                    >
                        <Plus className="w-4 h-4" />
                        Add Vendor
                    </button>
                </div>
            </div>

            {showExcelImport && (
                <ExcelUpload<{ name: string; contact_person?: string | null; email?: string | null; phone?: string | null; address?: string | null; status_notes?: string | null; gstin?: string | null; pan?: string | null }>
                    endpoint="/purchase/vendors/bulk"
                    templateFilename="vendors_template.xlsx"
                    templateHeaders={["Name", "Contact Person", "Email", "Phone", "Address", "Status Notes", "GSTIN", "PAN"]}
                    sampleRow={["Steel Corp Ltd", "Jane Smith", "jane@steelcorp.com", "9123456789", "456 Industrial Area", "RATES given", "23AABCT1234L1ZM", "AABCT1234L"]}
                    columnsHelp={[
                        { header: "Name", required: true, sample: "Steel Corp Ltd" },
                        { header: "Contact Person", required: false, sample: "Jane Smith" },
                        { header: "Email", required: false, sample: "jane@steelcorp.com" },
                        { header: "Phone", required: false, sample: "9123456789" },
                        { header: "Address", required: false, sample: "456 Industrial Area" },
                        { header: "Status Notes", required: false, sample: "RATES given" },
                        { header: "GSTIN", required: false, sample: "23AABCT1234L1ZM" },
                        { header: "PAN", required: false, sample: "AABCT1234L" },
                    ]}
                    mapRow={(row) => {
                        const name = String(row["Name"] ?? row["name"] ?? "").trim();
                        if (!name) return null;
                        const str = (v: unknown) => (v != null && String(v).trim() !== "" ? String(v).trim() : null);
                        return {
                            name,
                            contact_person: str(row["Contact Person"] ?? row["contact_person"]),
                            email: str(row["Email"] ?? row["email"]),
                            phone: str(row["Phone"] ?? row["phone"]),
                            address: str(row["Address"] ?? row["address"]),
                            status_notes: str(row["Status Notes"] ?? row["status_notes"]),
                            gstin: str(row["GSTIN"] ?? row["gstin"]),
                            pan: str(row["PAN"] ?? row["pan"]),
                        };
                    }}
                    onSuccess={() => fetchVendors()}
                    onClose={() => setShowExcelImport(false)}
                    title="Bulk import vendors"
                />
            )}

            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-card/60 border border-border rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-foreground">{vendors.length}</p>
                        <p className="text-xs text-muted-foreground">Total Vendors</p>
                    </div>
                </div>
                <div className="bg-card/60 border border-border rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Mail className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-foreground">
                            {vendors.filter((v) => v.email).length}
                        </p>
                        <p className="text-xs text-muted-foreground">With Email</p>
                    </div>
                </div>
                <div className="bg-card/60 border border-border rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                        <Phone className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-foreground">
                            {vendors.filter((v) => v.phone).length}
                        </p>
                        <p className="text-xs text-muted-foreground">With Phone</p>
                    </div>
                </div>
            </div>

            {/* Table Card */}
            <div className="bg-card/60 backdrop-blur-md border border-border rounded-2xl shadow-xl overflow-hidden">
                {/* Search Bar */}
                <div className="p-4 border-b border-border flex gap-4 bg-card">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            id="vendor-search"
                            type="text"
                            placeholder="Search vendors by name, contact, email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-sm text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground">
                        {filteredVendors.length} of {vendors.length} vendors
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-muted/30 text-muted-foreground font-medium">
                            <tr>
                                <th className="px-6 py-4">Vendor</th>
                                <th className="px-6 py-4">Contact Person</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Phone</th>
                                <th className="px-6 py-4">Address</th>
                                <th className="px-6 py-4">GSTIN</th>
                                <th className="px-6 py-4">Status / Notes</th>
                                <th className="px-6 py-4">Since</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-foreground">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                                            Loading vendors...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredVendors.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                                                <Users className="w-6 h-6 text-muted-foreground" />
                                            </div>
                                            <p className="text-muted-foreground">
                                                {searchTerm
                                                    ? "No vendors match your search."
                                                    : "No vendors yet. Add your first supplier."}
                                            </p>
                                            {!searchTerm && (
                                                <button
                                                    onClick={openCreateModal}
                                                    className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
                                                >
                                                    + Add Vendor
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredVendors.map((v) => (
                                    <tr
                                        key={v.id}
                                        className="hover:bg-muted/50 transition-colors group"
                                    >
                                        {/* Vendor Name with Avatar */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-300">
                                                    {getInitials(v.name)}
                                                </div>
                                                <span className="font-medium text-foreground">{v.name}</span>
                                            </div>
                                        </td>

                                        {/* Contact Person */}
                                        <td className="px-6 py-4">
                                            {v.contact_person ? (
                                                <div className="flex items-center gap-1.5">
                                                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                                                    {v.contact_person}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>

                                        {/* Email */}
                                        <td className="px-6 py-4">
                                            {v.email ? (
                                                <a
                                                    href={`mailto:${v.email}`}
                                                    className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors"
                                                >
                                                    <Mail className="w-3.5 h-3.5" />
                                                    {v.email}
                                                </a>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>

                                        {/* Phone */}
                                        <td className="px-6 py-4">
                                            {v.phone ? (
                                                <div className="flex items-center gap-1.5">
                                                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                                    {v.phone}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>

                                        {/* Address */}
                                        <td className="px-6 py-4 max-w-[200px]">
                                            {v.address ? (
                                                <div className="flex items-start gap-1.5 truncate" title={v.address}>
                                                    <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                                                    <span className="truncate">{v.address}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>

                                        {/* GSTIN */}
                                        <td className="px-6 py-4">
                                            {v.gstin ? (
                                                <span className="font-mono text-xs bg-black/50 rounded px-2">{v.gstin}</span>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>

                                        {/* Status / Notes (Reva: RATES given, don't sell, etc.) */}
                                        <td className="px-6 py-4 max-w-[140px]">
                                            {v.status_notes ? (
                                                <span className="text-amber-400/90 text-xs truncate block" title={v.status_notes}>{v.status_notes}</span>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>

                                        {/* Date */}
                                        <td className="px-6 py-4 text-muted-foreground text-xs">
                                            {new Date(v.created_at).toLocaleDateString("en-IN", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-6 py-4 text-right">
                                            <div className="relative inline-block" data-vendor-menu>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuId(openMenuId === v.id ? null : v.id);
                                                    }}
                                                    className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                                {openMenuId === v.id && (
                                                    <div className="absolute right-0 top-full mt-1 w-40 bg-[#1a1a1d] border border-border rounded-xl shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                                        <button
                                                            onClick={() => openEditModal(v)}
                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => confirmDelete(v)}
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

            {/* Create / Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                    <Users className="w-4 h-4 text-emerald-400" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground">
                                    {editingVendor ? "Edit Vendor" : "New Vendor"}
                                </h3>
                            </div>
                            <button
                                onClick={() => {
                                    setShowModal(false);
                                    setEditingVendor(null);
                                }}
                                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Vendor Name */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5" /> Vendor / Company Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm text-foreground placeholder:text-muted-foreground"
                                    placeholder="e.g. Reva Polymers Pvt Ltd"
                                />
                            </div>

                            {/* Contact Person */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5" /> Contact Person
                                </label>
                                <input
                                    type="text"
                                    value={form.contact_person}
                                    onChange={(e) =>
                                        setForm({ ...form, contact_person: e.target.value })
                                    }
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm text-foreground placeholder:text-muted-foreground"
                                    placeholder="e.g. Rajesh Kumar"
                                />
                            </div>

                            {/* Email + Phone side by side */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                        <Mail className="w-3.5 h-3.5" /> Email
                                    </label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm text-foreground placeholder:text-muted-foreground"
                                        placeholder="vendor@example.com"
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
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm text-foreground placeholder:text-muted-foreground"
                                        placeholder="+91 9876543210"
                                    />
                                </div>
                            </div>

                            {/* Address */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5" /> Address
                                </label>
                                <textarea
                                    rows={2}
                                    value={form.address}
                                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm text-foreground placeholder:text-muted-foreground resize-none"
                                    placeholder="123 Industrial Area, Jaipur, Rajasthan"
                                />
                            </div>

                            {/* GSTIN + PAN (India) */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">GSTIN</label>
                                    <input
                                        type="text"
                                        value={form.gstin}
                                        onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm font-mono text-foreground placeholder:text-muted-foreground"
                                        placeholder="e.g. 23AABCT1234L1ZM"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">PAN</label>
                                    <input
                                        type="text"
                                        value={form.pan}
                                        onChange={(e) => setForm({ ...form, pan: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm font-mono text-foreground placeholder:text-muted-foreground"
                                        placeholder="e.g. AABCT1234L"
                                    />
                                </div>
                            </div>

                            {/* Status / Notes (Reva: RATES given, don't sell, CALL NOT PICK) */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Status / Notes
                                </label>
                                <input
                                    type="text"
                                    value={form.status_notes}
                                    onChange={(e) => setForm({ ...form, status_notes: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm text-foreground placeholder:text-muted-foreground"
                                    placeholder="e.g. RATES given, don't sell, CALL NOT PICK"
                                />
                            </div>

                            {/* Actions */}
                            <div className="pt-4 flex justify-end gap-3 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setEditingVendor(null);
                                    }}
                                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl shadow-lg transition-colors flex items-center gap-2"
                                >
                                    {saving && (
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    )}
                                    {editingVendor ? "Update Vendor" : "Save Vendor"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="w-7 h-7 text-red-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                                Delete Vendor?
                            </h3>
                            <p className="text-sm text-muted-foreground mb-6">
                                Are you sure you want to delete{" "}
                                <span className="text-foreground font-medium">{deleteTarget.name}</span>?
                                This cannot be undone. Vendors with existing purchase orders cannot be
                                deleted.
                            </p>

                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
                                >
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
