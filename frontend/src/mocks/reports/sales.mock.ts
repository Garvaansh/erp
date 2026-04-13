import type {
  ReportFilters,
  ReportResponse,
  ReportRow,
} from "@/features/reports/types";

const SALES_ROWS: ReportRow[] = [
  {
    date: "2026-04-07",
    invoice_no: "INV-7801",
    customer: "Axis Hardware LLP",
    sku: "FG-5008",
    quantity: 64,
    uom: "box",
    unit_price: 1890,
    total_amount: 120960,
    channel: "Direct",
  },
  {
    date: "2026-04-09",
    invoice_no: "INV-7805",
    customer: "R3 Buildmart",
    sku: "FG-5012",
    quantity: 44,
    uom: "box",
    unit_price: 2140,
    total_amount: 94160,
    channel: "Distributor",
  },
  {
    date: "2026-04-10",
    invoice_no: "INV-7807",
    customer: "Surya Infra Supplies",
    sku: "FG-5008",
    quantity: 85,
    uom: "box",
    unit_price: 1870,
    total_amount: 158950,
    channel: "Direct",
  },
  {
    date: "2026-04-12",
    invoice_no: "INV-7812",
    customer: "Apex Projects",
    sku: "FG-5024",
    quantity: 25,
    uom: "kit",
    unit_price: 3680,
    total_amount: 92000,
    channel: "Online",
  },
  {
    date: "2026-04-13",
    invoice_no: "INV-7816",
    customer: "MediBuild Ventures",
    sku: "FG-5030",
    quantity: 31,
    uom: "kit",
    unit_price: 3420,
    total_amount: 106020,
    channel: "Distributor",
  },
];

function inDateRange(date: string, filters: ReportFilters): boolean {
  if (filters.from && date < filters.from) {
    return false;
  }

  if (filters.to && date > filters.to) {
    return false;
  }

  return true;
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getMockSalesReport(
  filters: ReportFilters,
): Promise<ReportResponse> {
  const rows = SALES_ROWS.filter((row) =>
    inDateRange(String(row.date ?? ""), filters),
  );

  return {
    summary: {
      records: rows.length,
      total_revenue: rows.reduce(
        (sum, row) => sum + toNumber(row.total_amount),
        0,
      ),
      units_sold: rows.reduce((sum, row) => sum + toNumber(row.quantity), 0),
    },
    rows,
  };
}
