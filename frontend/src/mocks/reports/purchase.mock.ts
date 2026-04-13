import type {
  ReportFilters,
  ReportResponse,
  ReportRow,
} from "@/features/reports/types";

const PURCHASE_ROWS: ReportRow[] = [
  {
    date: "2026-04-07",
    po_number: "PO-2407",
    vendor: "Nova Chemicals",
    material: "Binder Resin A",
    quantity: 300,
    uom: "kg",
    unit_price: 420,
    total_amount: 126000,
    status: "Delivered",
  },
  {
    date: "2026-04-08",
    po_number: "PO-2408",
    vendor: "MetalEdge Industries",
    material: "Aluminium Shot",
    quantity: 600,
    uom: "kg",
    unit_price: 198,
    total_amount: 118800,
    status: "Delivered",
  },
  {
    date: "2026-04-10",
    po_number: "PO-2410",
    vendor: "Aster Packaging",
    material: "Label Roll",
    quantity: 900,
    uom: "roll",
    unit_price: 24,
    total_amount: 21600,
    status: "Partially Received",
  },
  {
    date: "2026-04-11",
    po_number: "PO-2411",
    vendor: "Nova Chemicals",
    material: "Catalyst Additive",
    quantity: 180,
    uom: "kg",
    unit_price: 730,
    total_amount: 131400,
    status: "Pending",
  },
  {
    date: "2026-04-13",
    po_number: "PO-2413",
    vendor: "Prime Minerals",
    material: "Silica Filler",
    quantity: 1200,
    uom: "kg",
    unit_price: 92,
    total_amount: 110400,
    status: "Delivered",
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

export async function getMockPurchaseReport(
  filters: ReportFilters,
): Promise<ReportResponse> {
  const rows = PURCHASE_ROWS.filter((row) =>
    inDateRange(String(row.date ?? ""), filters),
  );

  return {
    summary: {
      records: rows.length,
      total_spend: rows.reduce(
        (sum, row) => sum + toNumber(row.total_amount),
        0,
      ),
      open_orders: rows.filter((row) => String(row.status).includes("Pending"))
        .length,
    },
    rows,
  };
}
