"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import type { FeatureFlagsMap, FeatureKey } from "./featureFlags";

export interface TenantSettings {
    tenant_id?: string;
    display_name: string;
    fiscal_year_start_month?: number;
    base_currency: string;
    locale: string;
    timezone: string;
    feature_flags?: FeatureFlagsMap;
}

type TenantSettingsContextValue = {
    tenantSettings: TenantSettings | null;
    featureFlags: FeatureFlagsMap | null;
    loading: boolean;
    refetch: () => Promise<void>;
    updateFeatureFlags: (flags: FeatureFlagsMap) => Promise<void>;
};

const defaultSettings: TenantSettings | null = null;
const TenantSettingsContext = createContext<TenantSettingsContextValue>({
    tenantSettings: defaultSettings,
    featureFlags: null,
    loading: true,
    refetch: async () => {},
    updateFeatureFlags: async () => {},
});

export function TenantSettingsProvider({ children }: { children: React.ReactNode }) {
    const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(null);
    const [featureFlags, setFeatureFlags] = useState<FeatureFlagsMap | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchSettings = useCallback(async () => {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!token) {
            setLoading(false);
            return;
        }
        try {
            const res = await api.get("/tenant/settings");
            const d = res.data;
            const flags = d?.feature_flags;
            setTenantSettings({
                tenant_id: d?.tenant_id,
                display_name: d?.display_name ?? "",
                fiscal_year_start_month: d?.fiscal_year_start_month ?? 4,
                base_currency: d?.base_currency ?? "INR",
                locale: d?.locale ?? "en-IN",
                timezone: d?.timezone ?? "Asia/Kolkata",
                feature_flags: typeof flags === "object" && flags !== null ? flags : {},
            });
            setFeatureFlags(typeof flags === "object" && flags !== null ? flags : {});
        } catch {
            setTenantSettings(null);
            setFeatureFlags({});
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const updateFeatureFlags = useCallback(
        async (flags: FeatureFlagsMap) => {
            try {
                await api.put("/tenant/settings", { feature_flags: flags });
                setFeatureFlags(flags);
                setTenantSettings((prev) => (prev ? { ...prev, feature_flags: flags } : null));
            } catch (err) {
                console.error(err);
                throw err;
            }
        },
        []
    );

    return (
        <TenantSettingsContext.Provider
            value={{
                tenantSettings,
                featureFlags,
                loading: loading,
                refetch: fetchSettings,
                updateFeatureFlags,
            }}
        >
            {children}
        </TenantSettingsContext.Provider>
    );
}

export function useTenantSettings() {
    return useContext(TenantSettingsContext);
}
