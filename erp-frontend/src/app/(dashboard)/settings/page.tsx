"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Building2, Loader2, Save, Sliders, ToggleLeft } from "lucide-react";
import { useTenantSettings } from "@/lib/TenantSettingsContext";
import {
    FEATURE_GROUPS,
    FEATURE_LABELS,
    isFeatureEnabled,
    type FeatureFlagsMap,
    type FeatureKey,
} from "@/lib/featureFlags";

interface TenantSettings {
    display_name: string;
    fiscal_year_start_month?: number;
    base_currency: string;
    locale: string;
    timezone: string;
}

interface CompanyProfile {
    tenant_id?: string | null;
    company_name: string;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    state_code?: string | null;
    pincode?: string | null;
    country?: string | null;
    gst_number?: string | null;
    tan?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    updated_at?: string | null;
}

const emptyProfile: CompanyProfile = {
    company_name: "Reva Technologies",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    state_code: "",
    pincode: "",
    country: "India",
    gst_number: "",
    tan: "",
    contact_email: "",
    contact_phone: "",
};

function str(o: unknown): string {
    if (o == null || o === undefined) return "";
    return String(o);
}

export default function SettingsPage() {
    const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(null);
    const [profile, setProfile] = useState<CompanyProfile>(emptyProfile);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingTenant, setSavingTenant] = useState(false);
    const { featureFlags, refetch, updateFeatureFlags } = useTenantSettings();
    const [savingFlags, setSavingFlags] = useState(false);

    useEffect(() => {
        fetchTenantSettings();
        fetchProfile();
    }, []);

    const fetchTenantSettings = async () => {
        try {
            const res = await api.get("/tenant/settings");
            const d = res.data;
            setTenantSettings({
                display_name: str(d?.display_name) || "",
                fiscal_year_start_month: d?.fiscal_year_start_month ?? 4,
                base_currency: str(d?.base_currency) || "INR",
                locale: str(d?.locale) || "en-IN",
                timezone: str(d?.timezone) || "Asia/Kolkata",
            });
            refetch();
        } catch {
            setTenantSettings(null);
        }
    };

    const handleFeatureToggle = async (key: FeatureKey, enabled: boolean) => {
        const next: FeatureFlagsMap = { ...(featureFlags || {}), [key]: enabled };
        setSavingFlags(true);
        try {
            await updateFeatureFlags(next);
        } catch {
            alert("Failed to update module visibility.");
        } finally {
            setSavingFlags(false);
        }
    };

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const res = await api.get("/reva/company-profile");
            const d = res.data;
            setProfile({
                company_name: str(d?.company_name) || emptyProfile.company_name,
                address_line1: str(d?.address_line1) || "",
                address_line2: str(d?.address_line2) || "",
                city: str(d?.city) || "",
                state: str(d?.state) || "",
                state_code: str(d?.state_code) || "",
                pincode: str(d?.pincode) || "",
                country: str(d?.country) || "India",
                gst_number: str(d?.gst_number) || "",
                tan: str(d?.tan) || "",
                contact_email: str(d?.contact_email) || "",
                contact_phone: str(d?.contact_phone) || "",
            });
        } catch (err) {
            console.error(err);
            setProfile({ ...emptyProfile });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put("/reva/company-profile", {
                company_name: profile.company_name || "Reva Technologies",
                address_line1: profile.address_line1 || undefined,
                address_line2: profile.address_line2 || undefined,
                city: profile.city || undefined,
                state: profile.state || undefined,
                state_code: profile.state_code || undefined,
                pincode: profile.pincode || undefined,
                country: profile.country || undefined,
                gst_number: profile.gst_number || undefined,
                tan: profile.tan || undefined,
                contact_email: profile.contact_email || undefined,
                contact_phone: profile.contact_phone || undefined,
            });
            await fetchProfile();
        } catch (err) {
            console.error(err);
            alert("Failed to save company profile.");
        } finally {
            setSaving(false);
        }
    };

    const handleTenantSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenantSettings) return;
        setSavingTenant(true);
        try {
            await api.put("/tenant/settings", {
                display_name: tenantSettings.display_name,
                base_currency: tenantSettings.base_currency,
                locale: tenantSettings.locale,
                timezone: tenantSettings.timezone,
            });
            await fetchTenantSettings();
        } catch {
            alert("Failed to save tenant settings.");
        } finally {
            setSavingTenant(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[320px]">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                    <span className="text-sm">Loading company profile…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Module visibility (feature flags) */}
            <div className="flex justify-between items-center bg-card/80 border border-border p-6 rounded-2xl shadow-xl">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center border border-violet-500/20">
                        <ToggleLeft className="w-6 h-6 text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Module visibility</h1>
                        <p className="text-sm text-muted-foreground">
                            Turn modules ON or OFF for this workspace. Hidden modules are removed from the sidebar and not accessible.
                        </p>
                    </div>
                </div>
            </div>
            <div className="bg-card/60 border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6">
                    {savingFlags && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                            <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                        </div>
                    )}
                    <div className="space-y-6">
                        {FEATURE_GROUPS.map((group) => (
                            <div key={group.title}>
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    {group.title}
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {group.keys.map((key) => {
                                        const enabled = isFeatureEnabled(featureFlags, key);
                                        return (
                                            <label
                                                key={key}
                                                className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer"
                                            >
                                                <span className="text-sm font-medium text-foreground">{FEATURE_LABELS[key]}</span>
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={enabled}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        handleFeatureToggle(key, !enabled);
                                                    }}
                                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${enabled ? "bg-primary" : "bg-muted"}`}
                                                >
                                                    <span
                                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-primary-foreground shadow ring-0 transition-transform ${enabled ? "translate-x-5" : "translate-x-1"}`}
                                                    />
                                                </button>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {tenantSettings != null && (
                <>
                    <div className="flex justify-between items-center bg-card/80 border border-border p-6 rounded-2xl shadow-xl mt-8">
                        <div className="flex gap-4 items-center">
                            <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                                <Sliders className="w-6 h-6 text-indigo-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Tenant Settings</h1>
                                <p className="text-sm text-muted-foreground">Workspace display name, currency, locale and timezone.</p>
                            </div>
                        </div>
                    </div>
                    <form onSubmit={handleTenantSubmit} className="bg-card/60 border border-border rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Display name</label>
                                <input
                                    type="text"
                                    value={tenantSettings.display_name}
                                    onChange={(e) => setTenantSettings({ ...tenantSettings, display_name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                                    placeholder="Your company or workspace name"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Base currency</label>
                                    <input
                                        type="text"
                                        value={tenantSettings.base_currency}
                                        onChange={(e) => setTenantSettings({ ...tenantSettings, base_currency: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                                        placeholder="INR"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Locale</label>
                                    <input
                                        type="text"
                                        value={tenantSettings.locale}
                                        onChange={(e) => setTenantSettings({ ...tenantSettings, locale: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                                        placeholder="en-IN"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Timezone</label>
                                    <input
                                        type="text"
                                        value={tenantSettings.timezone}
                                        onChange={(e) => setTenantSettings({ ...tenantSettings, timezone: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                                        placeholder="Asia/Kolkata"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end">
                            <button
                                type="submit"
                                disabled={savingTenant}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-70 text-white text-sm font-medium rounded-xl shadow-lg transition-colors flex items-center gap-2"
                            >
                                {savingTenant && <Loader2 className="w-4 h-4 animate-spin" />}
                                <Save className="w-4 h-4" />
                                Save tenant settings
                            </button>
                        </div>
                    </form>
                </>
            )}

            <div className="flex justify-between items-center bg-card/80 border border-border p-6 rounded-2xl shadow-xl">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                        <Building2 className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Company Profile</h1>
                        <p className="text-sm text-muted-foreground">Legal name, address, GST and contact details.</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-card/60 border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6 space-y-5">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Company name</label>
                        <input
                            type="text"
                            value={profile.company_name}
                            onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                            className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                            placeholder="Reva Technologies"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Address line 1</label>
                            <input
                                type="text"
                                value={profile.address_line1 ?? ""}
                                onChange={(e) => setProfile({ ...profile, address_line1: e.target.value })}
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                                placeholder="Govindpura, Bhopal"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Address line 2</label>
                            <input
                                type="text"
                                value={profile.address_line2 ?? ""}
                                onChange={(e) => setProfile({ ...profile, address_line2: e.target.value })}
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">City</label>
                            <input
                                type="text"
                                value={profile.city ?? ""}
                                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                                placeholder="Bhopal"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">State</label>
                            <input
                                type="text"
                                value={profile.state ?? ""}
                                onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                                placeholder="Madhya Pradesh"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Pincode</label>
                            <input
                                type="text"
                                value={profile.pincode ?? ""}
                                onChange={(e) => setProfile({ ...profile, pincode: e.target.value })}
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Country</label>
                        <input
                            type="text"
                            value={profile.country ?? ""}
                            onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                            className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                            placeholder="India"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">GST number (GSTIN)</label>
                            <input
                                type="text"
                                value={profile.gst_number ?? ""}
                                onChange={(e) => setProfile({ ...profile, gst_number: e.target.value })}
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground font-mono"
                                placeholder="e.g. 23AHRPA8602J1ZD"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">State code (2-digit for GST)</label>
                            <input
                                type="text"
                                value={profile.state_code ?? ""}
                                onChange={(e) => setProfile({ ...profile, state_code: e.target.value })}
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                                placeholder="e.g. 23 for MP"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">TAN (for TDS)</label>
                        <input
                            type="text"
                            value={profile.tan ?? ""}
                            onChange={(e) => setProfile({ ...profile, tan: e.target.value })}
                            className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground font-mono"
                            placeholder="e.g. BPLR12345A"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Contact email</label>
                            <input
                                type="email"
                                value={profile.contact_email ?? ""}
                                onChange={(e) => setProfile({ ...profile, contact_email: e.target.value })}
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Contact phone</label>
                            <input
                                type="text"
                                value={profile.contact_phone ?? ""}
                                onChange={(e) => setProfile({ ...profile, contact_phone: e.target.value })}
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-foreground"
                            />
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-70 text-white text-sm font-medium rounded-xl shadow-lg transition-colors flex items-center gap-2"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        <Save className="w-4 h-4" />
                        Save profile
                    </button>
                </div>
            </form>
        </div>
    );
}
