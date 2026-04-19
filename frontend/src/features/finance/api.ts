import { getProcurementList } from "@/features/procurement/api";
import type { PurchaseOrder } from "@/features/procurement/types";
import type {
  FinanceOverview,
  VendorFinanceRow,
  VendorPaymentStatusSummary,
} from "@/features/finance/types";

function numberOrZero(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function summarizeVendorPaymentStatus(
  totalPaid: number,
  totalDue: number,
): VendorPaymentStatusSummary {
  if (totalPaid <= 0) {
    return "UNPAID";
  }

  if (totalDue <= 0) {
    return "PAID";
  }

  return "PARTIAL";
}

export function buildVendorFinanceRows(
  rows: PurchaseOrder[],
): VendorFinanceRow[] {
  const grouped = new Map<string, VendorFinanceRow>();

  for (const row of rows) {
    const vendorID = row.vendor_id || row.vendor_name;
    const existing = grouped.get(vendorID);

    if (!existing) {
      grouped.set(vendorID, {
        vendor_id: vendorID,
        vendor_name: row.vendor_name,
        vendor_code: row.vendor_code,
        order_count: 1,
        total_value: numberOrZero(row.total_value),
        total_paid: numberOrZero(row.paid_amount),
        total_due: numberOrZero(row.due_amount),
        payment_status_summary: "UNPAID",
      });
      continue;
    }

    existing.order_count += 1;
    existing.total_value += numberOrZero(row.total_value);
    existing.total_paid += numberOrZero(row.paid_amount);
    existing.total_due += numberOrZero(row.due_amount);
  }

  const result = [...grouped.values()].map((row) => ({
    ...row,
    payment_status_summary: summarizeVendorPaymentStatus(
      row.total_paid,
      row.total_due,
    ),
  }));

  result.sort((a, b) => b.total_value - a.total_value);
  return result;
}

export async function getFinanceOverview(): Promise<FinanceOverview> {
  const procurement = await getProcurementList({ limit: 200, offset: 0 });
  const rows = buildVendorFinanceRows([
    ...(procurement.pending ?? []),
    ...(procurement.recent ?? []),
  ]);

  const totals = rows.reduce(
    (acc, row) => {
      acc.total_value += row.total_value;
      acc.total_paid += row.total_paid;
      acc.total_due += row.total_due;
      return acc;
    },
    {
      vendors: rows.length,
      total_value: 0,
      total_paid: 0,
      total_due: 0,
    },
  );

  return {
    rows,
    totals,
  };
}
