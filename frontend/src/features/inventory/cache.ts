import type { QueryClient } from "@tanstack/react-query";
import { inventoryKeys } from "@/lib/react-query/keys";

export async function invalidateFinishedGoodsQueries(
  queryClient: QueryClient,
  productId?: string,
) {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: inventoryKeys.finishedGoods() }),
    queryClient.invalidateQueries({ queryKey: inventoryKeys.snapshot() }),
  ];

  if (productId?.trim()) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.finishedGoodDetail(productId.trim()),
      }),
    );
  }

  await Promise.all(invalidations);
}
