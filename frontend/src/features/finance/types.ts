export type VendorPaymentStatusSummary = "UNPAID" | "PARTIAL" | "PAID";

export type VendorFinanceRow = {
  vendor_id: string;
  vendor_name: string;
  vendor_code?: string;
  order_count: number;
  total_value: number;
  total_paid: number;
  total_due: number;
  payment_status_summary: VendorPaymentStatusSummary;
};

export type FinanceOverviewTotals = {
  vendors: number;
  total_value: number;
  total_paid: number;
  total_due: number;
};

export type FinanceOverview = {
  rows: VendorFinanceRow[];
  totals: FinanceOverviewTotals;
};
