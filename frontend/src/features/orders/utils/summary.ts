import type { DraftLineInput } from "@/features/orders/types";

export type OrderSummary = {
  subtotal: number;
  totalQty: number;
  grandTotal: number;
};

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function calculateOrderSummary(lines: DraftLineInput[]): OrderSummary {
  return lines.reduce<OrderSummary>(
    (acc, line) => {
      const qty = toNumber(line.ordered_qty);
      const unitPrice = toNumber(line.unit_price);

      acc.totalQty += qty;
      acc.subtotal += qty * unitPrice;
      acc.grandTotal = acc.subtotal;
      return acc;
    },
    { subtotal: 0, totalQty: 0, grandTotal: 0 },
  );
}
