import { describe, expect, it } from "vitest";
import { calculateOrderSummary } from "@/features/orders/utils/summary";

describe("calculateOrderSummary", () => {
  it("calculates subtotal, total quantity, and grand total", () => {
    const summary = calculateOrderSummary([
      {
        key: "1",
        finished_good_item_id: "fg-1",
        ordered_qty: 10,
        unit_price: 120,
      },
      {
        key: "2",
        finished_good_item_id: "fg-2",
        ordered_qty: 5,
        unit_price: 80,
      },
    ]);

    expect(summary.totalQty).toBe(15);
    expect(summary.subtotal).toBe(1600);
    expect(summary.grandTotal).toBe(1600);
  });
});
