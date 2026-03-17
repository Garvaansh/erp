"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import {
    Warehouse,
    Plus,
    ChevronRight,
    X,
    Layers,
    Box,
    LayoutGrid,
    Package,
} from "lucide-react";

interface WarehouseItem {
    id: string;
    name: string;
    location: string | null;
    created_at: string;
}

interface Zone {
    id: string;
    tenant_id: string;
    warehouse_id: string;
    code: string;
    name: string | null;
    created_at: string;
}

interface Rack {
    id: string;
    zone_id: string;
    code: string;
    created_at: string;
}

interface Shelf {
    id: string;
    rack_id: string;
    code: string;
    created_at: string;
}

interface Bin {
    id: string;
    shelf_id: string;
    code: string;
    created_at: string;
}

type Level = "warehouse" | "zone" | "rack" | "shelf" | "bin";

export default function WarehouseStructurePage() {
    const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
    const [zones, setZones] = useState<Zone[]>([]);
    const [racks, setRacks] = useState<Rack[]>([]);
    const [shelves, setShelves] = useState<Shelf[]>([]);
    const [bins, setBins] = useState<Bin[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseItem | null>(null);
    const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
    const [selectedRack, setSelectedRack] = useState<Rack | null>(null);
    const [selectedShelf, setSelectedShelf] = useState<Shelf | null>(null);

    const [showAddModal, setShowAddModal] = useState(false);
    const [addLevel, setAddLevel] = useState<Level>("zone");
    const [addCode, setAddCode] = useState("");
    const [addName, setAddName] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchWarehouses();
    }, []);

    useEffect(() => {
        if (!selectedWarehouse) {
            setZones([]);
            setSelectedZone(null);
            setRacks([]);
            setSelectedRack(null);
            setShelves([]);
            setSelectedShelf(null);
            setBins([]);
            return;
        }
        fetchZones(selectedWarehouse.id);
    }, [selectedWarehouse]);

    useEffect(() => {
        if (!selectedZone) {
            setRacks([]);
            setSelectedRack(null);
            setShelves([]);
            setSelectedShelf(null);
            setBins([]);
            return;
        }
        fetchRacks(selectedZone.id);
    }, [selectedZone]);

    useEffect(() => {
        if (!selectedRack) {
            setShelves([]);
            setSelectedShelf(null);
            setBins([]);
            return;
        }
        fetchShelves(selectedRack.id);
    }, [selectedRack]);

    useEffect(() => {
        if (!selectedShelf) {
            setBins([]);
            return;
        }
        fetchBins(selectedShelf.id);
    }, [selectedShelf]);

    const fetchWarehouses = async () => {
        try {
            setLoading(true);
            const res = await api.get("/inventory/warehouses");
            setWarehouses(res.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchZones = async (warehouseId: string) => {
        try {
            const res = await api.get(`/inventory/warehouses/${warehouseId}/zones`);
            setZones(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchRacks = async (zoneId: string) => {
        try {
            const res = await api.get(`/inventory/zones/${zoneId}/racks`);
            setRacks(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchShelves = async (rackId: string) => {
        try {
            const res = await api.get(`/inventory/racks/${rackId}/shelves`);
            setShelves(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchBins = async (shelfId: string) => {
        try {
            const res = await api.get(`/inventory/shelves/${shelfId}/bins`);
            setBins(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const openAddModal = (level: Level) => {
        setAddLevel(level);
        setAddCode("");
        setAddName("");
        setShowAddModal(true);
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addCode.trim()) return;
        setSaving(true);
        try {
            if (addLevel === "zone" && selectedWarehouse) {
                await api.post(`/inventory/warehouses/${selectedWarehouse.id}/zones`, {
                    code: addCode.trim(),
                    name: addName.trim() || null,
                });
                fetchZones(selectedWarehouse.id);
            } else if (addLevel === "rack" && selectedZone) {
                await api.post(`/inventory/zones/${selectedZone.id}/racks`, { code: addCode.trim() });
                fetchRacks(selectedZone.id);
            } else if (addLevel === "shelf" && selectedRack) {
                await api.post(`/inventory/racks/${selectedRack.id}/shelves`, { code: addCode.trim() });
                fetchShelves(selectedRack.id);
            } else if (addLevel === "bin" && selectedShelf) {
                await api.post(`/inventory/shelves/${selectedShelf.id}/bins`, { code: addCode.trim() });
                fetchBins(selectedShelf.id);
            }
            setShowAddModal(false);
        } catch (err) {
            console.error(err);
            alert(`Failed to create ${addLevel}.`);
        } finally {
            setSaving(false);
        }
    };

    const breadcrumb = [];
    if (selectedWarehouse) breadcrumb.push({ label: selectedWarehouse.name, level: "warehouse" });
    if (selectedZone) breadcrumb.push({ label: `Zone ${selectedZone.code}`, level: "zone" });
    if (selectedRack) breadcrumb.push({ label: `Rack ${selectedRack.code}`, level: "rack" });
    if (selectedShelf) breadcrumb.push({ label: `Shelf ${selectedShelf.code}`, level: "shelf" });

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center bg-card/80 border border-border p-6 rounded-2xl shadow-xl">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center border border-orange-500/20">
                        <Warehouse className="w-6 h-6 text-orange-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
                            Warehouse Structure
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Manage zones, racks, shelves, and bins for each warehouse.
                        </p>
                    </div>
                </div>
            </div>

            {/* Breadcrumb */}
            {breadcrumb.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedWarehouse(null);
                            setSelectedZone(null);
                            setSelectedRack(null);
                            setSelectedShelf(null);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        All warehouses
                    </button>
                    {breadcrumb.map((b, i) => (
                        <span key={i} className="flex items-center gap-2">
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            <span className="text-foreground font-medium">{b.label}</span>
                        </span>
                    ))}
                </div>
            )}

            <div className="bg-card/60 border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between bg-card">
                    <h2 className="text-sm font-medium text-foreground">
                        {!selectedWarehouse && "Select a warehouse"}
                        {selectedWarehouse && !selectedZone && "Zones"}
                        {selectedZone && !selectedRack && "Racks"}
                        {selectedRack && !selectedShelf && "Shelves"}
                        {selectedShelf && "Bins"}
                    </h2>
                    {selectedWarehouse && !selectedZone && (
                        <button
                            type="button"
                            onClick={() => openAddModal("zone")}
                            className="text-orange-400 hover:text-orange-300 text-sm font-medium flex items-center gap-1"
                        >
                            <Plus className="w-4 h-4" /> Add zone
                        </button>
                    )}
                    {selectedZone && !selectedRack && (
                        <button type="button" onClick={() => openAddModal("rack")} className="text-orange-400 hover:text-orange-300 text-sm font-medium flex items-center gap-1">
                            <Plus className="w-4 h-4" /> Add rack
                        </button>
                    )}
                    {selectedRack && !selectedShelf && (
                        <button type="button" onClick={() => openAddModal("shelf")} className="text-orange-400 hover:text-orange-300 text-sm font-medium flex items-center gap-1">
                            <Plus className="w-4 h-4" /> Add shelf
                        </button>
                    )}
                    {selectedShelf && (
                        <button type="button" onClick={() => openAddModal("bin")} className="text-orange-400 hover:text-orange-300 text-sm font-medium flex items-center gap-1">
                            <Plus className="w-4 h-4" /> Add bin
                        </button>
                    )}
                </div>

                <div className="p-6 min-h-[200px]">
                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-muted-foreground">
                            Loading...
                        </div>
                    ) : !selectedWarehouse ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {warehouses.length === 0 ? (
                                <p className="text-muted-foreground col-span-full py-8 text-center">No warehouses. Create one from Inventory.</p>
                            ) : (
                                warehouses.map((wh) => (
                                    <button
                                        key={wh.id}
                                        type="button"
                                        onClick={() => setSelectedWarehouse(wh)}
                                        className="flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 text-left transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                            <Warehouse className="w-5 h-5 text-orange-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-foreground">{wh.name}</p>
                                            {wh.location && <p className="text-xs text-muted-foreground truncate">{wh.location}</p>}
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                                    </button>
                                ))
                            )}
                        </div>
                    ) : !selectedZone ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {zones.length === 0 ? (
                                <p className="text-muted-foreground col-span-full py-8 text-center">No zones. Add one above.</p>
                            ) : (
                                zones.map((z) => (
                                    <button
                                        key={z.id}
                                        type="button"
                                        onClick={() => setSelectedZone(z)}
                                        className="flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 text-left transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                            <Layers className="w-5 h-5 text-orange-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-foreground">{z.code}</p>
                                            {z.name && <p className="text-xs text-muted-foreground">{z.name}</p>}
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                                    </button>
                                ))
                            )}
                        </div>
                    ) : !selectedRack ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {racks.length === 0 ? (
                                <p className="text-muted-foreground col-span-full py-8 text-center">No racks. Add one above.</p>
                            ) : (
                                racks.map((r) => (
                                    <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => setSelectedRack(r)}
                                        className="flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 text-left transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                            <LayoutGrid className="w-5 h-5 text-orange-400" />
                                        </div>
                                        <p className="font-medium text-foreground">Rack {r.code}</p>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                                    </button>
                                ))
                            )}
                        </div>
                    ) : !selectedShelf ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {shelves.length === 0 ? (
                                <p className="text-muted-foreground col-span-full py-8 text-center">No shelves. Add one above.</p>
                            ) : (
                                shelves.map((s) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setSelectedShelf(s)}
                                        className="flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 text-left transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                            <Box className="w-5 h-5 text-orange-400" />
                                        </div>
                                        <p className="font-medium text-foreground">Shelf {s.code}</p>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                                    </button>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {bins.length === 0 ? (
                                <p className="text-muted-foreground col-span-full py-8 text-center">No bins. Add one above.</p>
                            ) : (
                                bins.map((b) => (
                                    <div
                                        key={b.id}
                                        className="flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/30"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                            <Package className="w-5 h-5 text-orange-400" />
                                        </div>
                                        <p className="font-medium text-foreground">Bin {b.code}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Add modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
                        <h3 className="text-lg font-medium text-foreground mb-4">
                            Add {addLevel}
                        </h3>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Code *</label>
                                <input
                                    type="text"
                                    value={addCode}
                                    onChange={(e) => setAddCode(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                    placeholder={addLevel === "zone" ? "e.g. A" : "e.g. 01"}
                                    required
                                />
                            </div>
                            {addLevel === "zone" && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Name (optional)</label>
                                    <input
                                        type="text"
                                        value={addName}
                                        onChange={(e) => setAddName(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground"
                                        placeholder="e.g. Receiving"
                                    />
                                </div>
                            )}
                            <div className="flex gap-2 justify-end pt-2">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50">
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving} className="px-5 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl">
                                    {saving ? "Adding..." : "Add"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
