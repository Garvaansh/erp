export type ReportColumn = {
  key: string;
  label: string;
};

export type ReportConfig = {
  key: "inventory" | "purchase" | "sales";
  title: string;
  columns: ReportColumn[];
};

export const REPORTS: Record<ReportConfig["key"], ReportConfig> = {
  inventory: {
    key: "inventory",
    title: "Inventory Production Report",
    columns: [
      { key: "date", label: "Date" },
      { key: "sku", label: "SKU" },
      { key: "item_name", label: "Item" },
      { key: "warehouse", label: "Warehouse" },
      { key: "lot_no", label: "Lot" },
      { key: "quantity", label: "Quantity" },
      { key: "uom", label: "UOM" },
      { key: "unit_cost", label: "Unit Cost" },
      { key: "stock_value", label: "Stock Value" },
    ],
  },
  purchase: {
    key: "purchase",
    title: "Purchase Performance Report",
    columns: [
      { key: "date", label: "Date" },
      { key: "po_number", label: "PO Number" },
      { key: "vendor", label: "Vendor" },
      { key: "material", label: "Material" },
      { key: "quantity", label: "Quantity" },
      { key: "uom", label: "UOM" },
      { key: "unit_price", label: "Unit Price" },
      { key: "total_amount", label: "Total Amount" },
      { key: "status", label: "Status" },
    ],
  },
  sales: {
    key: "sales",
    title: "Sales Dispatch Report",
    columns: [
      { key: "date", label: "Date" },
      { key: "invoice_no", label: "Invoice" },
      { key: "customer", label: "Customer" },
      { key: "sku", label: "SKU" },
      { key: "quantity", label: "Quantity" },
      { key: "uom", label: "UOM" },
      { key: "unit_price", label: "Unit Price" },
      { key: "total_amount", label: "Total Amount" },
      { key: "channel", label: "Channel" },
    ],
  },
};
