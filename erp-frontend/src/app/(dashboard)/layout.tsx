"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
    LayoutDashboard,
    Box,
    Truck,
    Users,
    ShoppingCart,
    FileText,
    Receipt,
    Wrench,
    BarChart,
    LogOut,
    Factory,
    Layers,
    History,
    Package,
    Settings,
    ScrollText,
    ListChecks,
    ClipboardList,
    PackageCheck,
    Warehouse,
    PanelLeftClose,
    PanelLeftOpen,
    Building2,
    Banknote,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TenantSettingsProvider, useTenantSettings } from "@/lib/TenantSettingsContext";
import {
    isFeatureEnabled,
    PATH_TO_FEATURE,
    FEATURE_KEYS,
    type FeatureKey,
} from "@/lib/featureFlags";

const MOCK_DATA_KEY = "mock_data";
const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";

type MockDataContextValue = { mockData: boolean; setMockData: (v: boolean) => void };
const MockDataContext = createContext<MockDataContextValue>({ mockData: false, setMockData: () => {} });

export function useMockData() {
    return useContext(MockDataContext);
}

/** Production-style ERP nav: sections with optional feature keys. */
const NAV_SECTIONS: { title: string; items: { label: string; href: string; icon: React.ComponentType<{ className?: string }>; featureKey?: FeatureKey }[] }[] = [
    {
        title: "Overview",
        items: [
            { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, featureKey: FEATURE_KEYS.dashboard },
        ],
    },
    {
        title: "Master Data",
        items: [
            { label: "Products", href: "/products", icon: Box, featureKey: FEATURE_KEYS.products },
            { label: "Vendors", href: "/vendors", icon: Users, featureKey: FEATURE_KEYS.vendors },
            { label: "Customers", href: "/customers", icon: Users, featureKey: FEATURE_KEYS.customers },
        ],
    },
    {
        title: "Procurement",
        items: [
            { label: "Requisitions", href: "/requisitions", icon: ListChecks, featureKey: FEATURE_KEYS.requisitions },
            { label: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart, featureKey: FEATURE_KEYS.purchase_orders },
            { label: "Goods Receipts", href: "/goods-receipts", icon: Package, featureKey: FEATURE_KEYS.goods_receipts },
            { label: "Vendor Invoices", href: "/vendor-invoices", icon: Receipt, featureKey: FEATURE_KEYS.vendor_invoices },
            { label: "Purchase History", href: "/purchase-history", icon: History, featureKey: FEATURE_KEYS.purchase_history },
        ],
    },
    {
        title: "Inventory",
        items: [
            { label: "Stock & Transactions", href: "/inventory", icon: Truck, featureKey: FEATURE_KEYS.inventory },
            { label: "Warehouse Structure", href: "/warehouse-structure", icon: Warehouse, featureKey: FEATURE_KEYS.warehouse_structure },
            { label: "Stock Coil", href: "/stock-coil", icon: Package, featureKey: FEATURE_KEYS.stock_coil },
        ],
    },
    {
        title: "Manufacturing",
        items: [
            { label: "Production Orders", href: "/production-orders", icon: Factory, featureKey: FEATURE_KEYS.production_orders },
            { label: "Work Orders", href: "/work-orders", icon: Wrench, featureKey: FEATURE_KEYS.manufacturing },
            { label: "MRP Report", href: "/mrp", icon: ClipboardList, featureKey: FEATURE_KEYS.mrp_report },
            { label: "Coil Consumption", href: "/coil-consumption", icon: Layers, featureKey: FEATURE_KEYS.coil_consumption },
        ],
    },
    {
        title: "Sales",
        items: [
            { label: "Sales Orders", href: "/sales-orders", icon: ShoppingCart, featureKey: FEATURE_KEYS.sales_orders },
            { label: "Invoices", href: "/invoices", icon: FileText, featureKey: FEATURE_KEYS.invoices },
            { label: "Shipments", href: "/shipments", icon: PackageCheck, featureKey: FEATURE_KEYS.shipments },
        ],
    },
    {
        title: "Reports",
        items: [
            { label: "Reports", href: "/reports", icon: BarChart, featureKey: FEATURE_KEYS.reports },
        ],
    },
    {
        title: "Organization",
        items: [
            { label: "Company Codes", href: "/company-codes", icon: Building2, featureKey: FEATURE_KEYS.organization },
            { label: "Plants", href: "/plants", icon: Building2, featureKey: FEATURE_KEYS.organization },
        ],
    },
    {
        title: "Finance",
        items: [
            { label: "Chart of Accounts", href: "/chart-of-accounts", icon: Banknote, featureKey: FEATURE_KEYS.finance },
            { label: "G/L Accounts", href: "/gl-accounts", icon: Banknote, featureKey: FEATURE_KEYS.finance },
            { label: "Cost Centers", href: "/cost-centers", icon: Banknote, featureKey: FEATURE_KEYS.finance },
        ],
    },
    {
        title: "Administration",
        items: [
            { label: "Audit Logs", href: "/audit", icon: ScrollText, featureKey: FEATURE_KEYS.audit_logs },
            { label: "Company Profile", href: "/settings", icon: Settings, featureKey: FEATURE_KEYS.settings },
        ],
    },
];

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const [mockData, setMockDataState] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
    const { featureFlags, loading: settingsLoading } = useTenantSettings();

    useEffect(() => {
        setMounted(true);
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/");
        }
        setMockDataState(localStorage.getItem(MOCK_DATA_KEY) === "true");
        setSidebarCollapsedState(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
    }, [router]);

    const setSidebarCollapsed = (v: boolean) => {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, v ? "true" : "false");
        setSidebarCollapsedState(v);
    };

    // Route guard: if current path's feature is disabled, redirect to dashboard
    useEffect(() => {
        if (!mounted || settingsLoading) return;
        const basePath = pathname?.split("/").slice(0, 2).join("/") || pathname;
        const featureKey = PATH_TO_FEATURE[basePath];
        if (featureKey && !isFeatureEnabled(featureFlags, featureKey)) {
            router.replace("/dashboard");
        }
    }, [mounted, settingsLoading, pathname, featureFlags, router]);

    const setMockData = (v: boolean) => {
        localStorage.setItem(MOCK_DATA_KEY, v ? "true" : "false");
        setMockDataState(v);
    };

    if (!mounted) return null;

    const handleLogout = () => {
        localStorage.removeItem("token");
        router.push("/");
    };

    return (
        <MockDataContext.Provider value={{ mockData, setMockData }}>
            <div className="flex h-screen bg-background overflow-hidden">
                <aside
                    className={`flex-shrink-0 bg-card border-r border-border shadow-xl flex flex-col justify-between hidden md:flex transition-[width] duration-200 ease-in-out ${
                        sidebarCollapsed ? "w-[4.5rem]" : "w-64"
                    }`}
                >
                    <div className="flex flex-col h-full min-h-0">
                        <div className="h-16 flex items-center justify-between px-3 border-b border-border shrink-0">
                            <Link
                                href="/dashboard"
                                className={`flex items-center gap-2 group overflow-hidden ${sidebarCollapsed ? "justify-center w-full" : ""}`}
                            >
                                <div className="bg-primary/20 p-1.5 rounded-lg border border-primary/30 group-hover:bg-primary/30 transition-colors shrink-0">
                                    <Factory className="w-5 h-5 text-primary" />
                                </div>
                                {!sidebarCollapsed && (
                                    <span className="font-semibold text-foreground tracking-wide truncate">ERP</span>
                                )}
                            </Link>
                            {!sidebarCollapsed && (
                                <button
                                    type="button"
                                    onClick={() => setSidebarCollapsed(true)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                                    title="Collapse sidebar"
                                >
                                    <PanelLeftClose className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-4">
                            <div className={`space-y-6 ${sidebarCollapsed ? "px-2" : "px-4"}`}>
                                {NAV_SECTIONS.map((section) => {
                                    const visibleItems = section.items.filter(
                                        (item) => !item.featureKey || isFeatureEnabled(featureFlags, item.featureKey)
                                    );
                                    if (visibleItems.length === 0) return null;
                                    return (
                                        <div key={section.title}>
                                            {!sidebarCollapsed && (
                                                <div className="text-xs font-semibold text-muted-foreground mb-2 px-2 tracking-wider uppercase">
                                                    {section.title}
                                                </div>
                                            )}
                                            <div className="space-y-1">
                                                {visibleItems.map((item) => {
                                                    const active = pathname === item.href;
                                                    const Icon = item.icon;
                                                    return (
                                                        <Link
                                                            key={item.href}
                                                            href={item.href}
                                                            title={sidebarCollapsed ? item.label : undefined}
                                                            className={`flex items-center rounded-xl transition-all duration-200 ${
                                                                sidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
                                                            } ${
                                                                active
                                                                    ? "bg-primary/10 text-primary font-medium"
                                                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                                            }`}
                                                        >
                                                            <Icon className={`w-4 h-4 shrink-0 ${active ? "text-primary" : ""}`} />
                                                            {!sidebarCollapsed && (
                                                                <>
                                                                    <span className="text-sm truncate">{item.label}</span>
                                                                    {active && (
                                                                        <div className="ml-auto w-1 h-1 bg-primary rounded-full ring-2 ring-primary/30 shrink-0" />
                                                                    )}
                                                                </>
                                                            )}
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="p-2 border-t border-border shrink-0 space-y-1">
                            {sidebarCollapsed ? (
                                <button
                                    type="button"
                                    onClick={() => setSidebarCollapsed(false)}
                                    className="w-full flex items-center justify-center p-2.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                    title="Expand sidebar"
                                >
                                    <PanelLeftOpen className="w-5 h-5" />
                                </button>
                            ) : null}
                            <button
                                onClick={handleLogout}
                                className={`flex items-center w-full rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors text-sm ${
                                    sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
                                }`}
                                title={sidebarCollapsed ? "Sign Out" : undefined}
                            >
                                <LogOut className="w-4 h-4 shrink-0" />
                                {!sidebarCollapsed && <span>Sign Out</span>}
                            </button>
                        </div>
                    </div>
                </aside>

                <main className="flex-1 flex flex-col h-full bg-background relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-[600px] h-[300px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
                    <div className="absolute bottom-0 left-[20%] w-[600px] h-[300px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

                    <header className="h-16 flex items-center px-8 border-b border-border bg-card/80 backdrop-blur-md z-10 shrink-0">
                        <div className="ml-auto flex items-center gap-4">
                            <ThemeToggle />
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <span className="text-xs text-muted-foreground">Mock data (1L)</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={mockData}
                                    onClick={() => setMockData(!mockData)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${mockData ? "bg-amber-500/80" : "bg-muted"}`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-primary-foreground shadow ring-0 transition-transform ${mockData ? "translate-x-5" : "translate-x-1"}`}
                                    />
                                </button>
                                <span className="text-xs text-muted-foreground">{mockData ? "ON" : "OFF"}</span>
                            </label>
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 text-primary font-medium text-xs shadow-inner cursor-pointer hover:bg-primary/30 transition-colors">
                                AD
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 overflow-auto p-8 z-10">
                        <div className="max-w-6xl mx-auto">{children}</div>
                    </div>
                </main>
            </div>
        </MockDataContext.Provider>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <TenantSettingsProvider>
            <DashboardLayoutInner>{children}</DashboardLayoutInner>
        </TenantSettingsProvider>
    );
}
