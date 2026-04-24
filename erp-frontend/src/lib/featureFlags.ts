```
/**
 * Feature flag keys stored in tenant_settings.feature_flags (JSON).
 * If a key is missing or true, the feature is ON. If false, the feature is OFF for that tenant.
 */
export const FEATURE_KEYS = {
    dashboard: "dashboard",
    products: "products",
    vendors: "vendors",
    customers: "customers",
    inventory: "inventory",
    warehouse_structure: "warehouse_structure",
    stock_coil: "stock_coil",
    requisitions: "requisitions",
    purchase_orders: "purchase_orders",
    goods_receipts: "goods_receipts",
    vendor_invoices: "vendor_invoices",
    purchase_history: "purchase_history",
    manufacturing: "manufacturing",
    production_orders: "production_orders",
    mrp_report: "mrp_report",
    coil_consumption: "coil_consumption",
    sales_orders: "sales_orders",
    invoices: "invoices",
    shipments: "shipments",
    reports: "reports",
    audit_logs: "audit_logs",
    settings: "settings",
    organization: "organization",
    finance: "finance",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

export type FeatureFlagsMap = Partial<Record<FeatureKey, boolean>>;

/** Feature is enabled if not explicitly set to false (missing = enabled for backward compatibility). */
export function isFeatureEnabled(flags: FeatureFlagsMap | null | undefined, key: FeatureKey): boolean {
    if (!flags || typeof flags!== "object") return true;
    return flags[key]!== false;
}

/** Pathname to feature key (for route guard). Dashboard and settings are always allowed. */
export const PATH_TO_FEATURE: Record<string, FeatureKey> = {
    "/dashboard": FEATURE_KEYS.dashboard,
    "/products": FEATURE_KEYS.products,
    "/inventory": FEATURE_KEYS.inventory,
    "/stock-coil": FEATURE_KEYS.stock_coil,
    "/coil-consumption": FEATURE_KEYS.coil_consumption,
    "/purchase-history": FEATURE_KEYS.purchase_history,
    "/vendors": FEATURE_KEYS.vendors,
    "/purchase-orders": FEATURE_KEYS.purchase_orders,
    "/goods-receipts": FEATURE_KEYS.goods_receipts,
    "/vendor-invoices": FEATURE_KEYS.vendor_invoices,
    "/customers": FEATURE_KEYS.customers,
    "/sales-orders": FEATURE_KEYS.sales_orders,
    "/invoices": FEATURE_KEYS.invoices,
    "/work-orders": FEATURE_KEYS.manufacturing,
    "/production-orders": FEATURE_KEYS.production_orders,
    "/mrp": FEATURE_KEYS.mrp_report,
    "/requisitions": FEATURE_KEYS.requisitions,
    "/shipments": FEATURE_KEYS.shipments,
    "/warehouse-structure": FEATURE_KEYS.warehouse_structure,
    "/reports": FEATURE_KEYS.reports,
    "/audit": FEATURE_KEYS.audit_logs,
    "/settings": FEATURE_KEYS.settings,
    "/company-codes": FEATURE_KEYS.organization,
    "/plants": FEATURE_KEYS.organization,
    "/chart-of-accounts": FEATURE_KEYS.finance,
    "/gl-accounts": FEATURE_KEYS.finance,
    "/cost-centers": FEATURE_KEYS.finance,
};

/** All feature keys with human-readable labels for Settings UI. */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
    dashboard: "Dashboard",
    products: "Products",
    vendors: "Vendors",
    customers: "Customers",
    inventory: "Stock & transactions",
    warehouse_structure: "Warehouse structure (zones, racks, bins)",
    stock_coil: "Stock Coil (Reva)",
    requisitions: "Purchase requisitions",
    purchase_orders: "Purchase orders",
    goods_receipts: "Goods receipts",
    vendor_invoices: "Vendor invoices",
    purchase_history: "Purchase history",
    manufacturing: "Work orders",
    production_orders: "Production orders",
    mrp_report: "MRP report",
    coil_consumption: "Coil consumption (Reva)",
    sales_orders: "Sales orders",
    invoices: "Invoices",
    shipments: "Shipments",
    reports: "Reports",
    audit_logs: "Audit logs",
    settings: "Company profile & settings",
    organization: "Organization (company codes, plants)",
    finance: "Finance (chart of accounts, G/L accounts, cost centers)",
};

/** Logical groups for Module visibility in Settings (matches sidebar sections). */
export const FEATURE_GROUPS: { title: string; keys: FeatureKey[] }[] = [
    { title: "Overview", keys: [FEATURE_KEYS.dashboard] },
    { title: "Master Data", keys: [FEATURE_KEYS.products, FEATURE_KEYS.vendors, FEATURE_KEYS.customers] },
    {
        title: "Procurement",
        keys: [
            FEATURE_KEYS.requisitions,
            FEATURE_KEYS.purchase_orders,
            FEATURE_KEYS.goods_receipts,
            FEATURE_KEYS.vendor_invoices,
            FEATURE_KEYS.purchase_history,
        ],
    },
    {
        title: "Inventory",
        keys: [FEATURE_KEYS.inventory, FEATURE_KEYS.warehouse_structure, FEATURE_KEYS.stock_coil],
    },
    {
        title: "Manufacturing",
        keys: [
            FEATURE_KEYS.production_orders,
            FEATURE_KEYS.manufacturing,
            FEATURE_KEYS.mrp_report,
            FEATURE_KEYS.coil_consumption,
        ],
    },
    {
        title: "Sales",
        keys: [FEATURE_KEYS.sales_orders, FEATURE_KEYS.invoices, FEATURE_KEYS.shipments],
    },
    { title: "Reports", keys: [FEATURE_KEYS.reports] },
    { title: "Organization", keys: [FEATURE_KEYS.organization] },
    { title: "Finance", keys: [FEATURE_KEYS.finance] },
    { title: "Administration", keys: [FEATURE_KEYS.audit_logs, FEATURE_KEYS.settings] },
];
```