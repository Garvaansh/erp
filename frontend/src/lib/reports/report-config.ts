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
      { key: "item_id", label: "Item ID" },
      { key: "sku", label: "SKU" },
      { key: "name", label: "Item" },
      { key: "category", label: "Category" },
      { key: "total_qty", label: "Total Qty" },
      { key: "available_qty", label: "Available Qty" },
      { key: "reserved_qty", label: "Reserved Qty" },
      { key: "min_qty", label: "Min Qty" },
      { key: "max_qty", label: "Max Qty" },
      { key: "batch_count", label: "Batches" },
      { key: "is_low_stock", label: "Low Stock" },
    ],
  },
  purchase: {
    key: "purchase",
    title: "Purchase Performance Report",
    columns: [
      { key: "date", label: "Date" },
      { key: "transaction_ref", label: "Transaction Ref" },
      { key: "vendor_name", label: "Vendor" },
      { key: "item", label: "Item" },
      { key: "sku", label: "SKU" },
      { key: "quantity", label: "Quantity" },
      { key: "unit_cost", label: "Unit Cost" },
      { key: "total_value", label: "Total Value" },
      { key: "payment_status", label: "Payment Status" },
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
