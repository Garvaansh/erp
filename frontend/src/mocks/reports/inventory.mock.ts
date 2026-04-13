import type {
  ReportFilters,
  ReportResponse,
  ReportRow,
} from "@/features/reports/types";

const INVENTORY_ROWS: ReportRow[] = [
  {
    date: "2026-04-08",
    sku: "RM-1001",
    item_name: "Aluminium Granules",
    warehouse: "Main WH",
    lot_no: "LOT-AL-008",
    quantity: 1200,
    uom: "kg",
    unit_cost: 210,
    stock_value: 252000,
  },
  {
    date: "2026-04-09",
    sku: "RM-1024",
    item_name: "Silica Powder",
    warehouse: "Main WH",
    lot_no: "LOT-SI-212",
    quantity: 850,
    uom: "kg",
    unit_cost: 96,
    stock_value: 81600,
  },
  {
    date: "2026-04-10",
    sku: "PK-2002",
    item_name: "Corrugated Box - Medium",
    warehouse: "Packing WH",
    lot_no: "LOT-PK-119",
    quantity: 4200,
    uom: "pcs",
    unit_cost: 18,
    stock_value: 75600,
  },
  {
    date: "2026-04-11",
    sku: "RM-1060",
    item_name: "Titanium Dioxide",
    warehouse: "Main WH",
    lot_no: "LOT-TD-031",
    quantity: 430,
    uom: "kg",
    unit_cost: 340,
    stock_value: 146200,
  },
  {
    date: "2026-04-12",
    sku: "FG-5008",
    item_name: "Ceramic Coating Kit",
    warehouse: "Finished Goods WH",
    lot_no: "LOT-FG-777",
    quantity: 190,
    uom: "box",
    unit_cost: 1240,
    stock_value: 235600,
  },
  {
    date: "2026-04-13",
    sku: "RM-1001",
    item_name: "Aluminium Granules",
    warehouse: "Main WH",
    lot_no: "LOT-AL-009",
    quantity: 980,
    uom: "kg",
    unit_cost: 212,
    stock_value: 207760,
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

export async function getMockInventoryReport(
  filters: ReportFilters,
): Promise<ReportResponse> {
  const rows = INVENTORY_ROWS.filter((row) =>
    inDateRange(String(row.date ?? ""), filters),
  );

  return {
    summary: {
      records: rows.length,
      total_quantity: rows.reduce(
        (sum, row) => sum + toNumber(row.quantity),
        0,
      ),
      total_stock_value: rows.reduce(
        (sum, row) => sum + toNumber(row.stock_value),
        0,
      ),
    },
    rows,
  };
}
