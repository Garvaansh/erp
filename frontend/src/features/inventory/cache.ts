import type { QueryClient } from "@tanstack/react-query";
import { inventoryKeys } from "@/lib/react-query/keys";

export async function invalidateRawMaterialQueries(
  queryClient: QueryClient,
  itemId?: string,
) {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: inventoryKeys.rawMaterials() }),
    queryClient.invalidateQueries({ queryKey: inventoryKeys.snapshot() }),
  ];

  if (itemId?.trim()) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.rawMaterialSummary(itemId.trim()),
      }),
    );
  }

  await Promise.all(invalidations);
}

export async function invalidateFinishedGoodsQueries(
  queryClient: QueryClient,
  itemId?: string,
) {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: inventoryKeys.finishedGoods() }),
    queryClient.invalidateQueries({ queryKey: inventoryKeys.snapshot() }),
  ];

  if (itemId?.trim()) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.finishedGoodDetail(itemId.trim()),
      }),
    );
  }

  await Promise.all(invalidations);
}
