import { describe, expect, it, vi } from "vitest";
import { invalidateFinishedGoodsQueries } from "@/features/inventory/cache";
import { inventoryKeys } from "@/lib/react-query/keys";

describe("invalidateFinishedGoodsQueries", () => {
  it("invalidates master, snapshot, and optional detail queries", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient = {
      invalidateQueries,
    };

    await invalidateFinishedGoodsQueries(
      queryClient as unknown as Parameters<
        typeof invalidateFinishedGoodsQueries
      >[0],
      "product-1",
    );

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: inventoryKeys.finishedGoods(),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: inventoryKeys.snapshot(),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: inventoryKeys.finishedGoodDetail("product-1"),
    });
  });
});
