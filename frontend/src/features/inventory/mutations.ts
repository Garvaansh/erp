import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { updateBatchStatus, updateItemThreshold } from "@/lib/api/inventory";
import type { UpdateBatchStatusPayload } from "@/features/inventory/types";
import { inventoryKeys, reportsKeys } from "@/lib/react-query/keys";

type UpdateBatchStatusVariables = {
  batchId: string;
  itemId: string;
  payload: UpdateBatchStatusPayload;
};

type UpdateThresholdVariables = {
  itemId: string;
  threshold: number;
};

async function invalidateRawMaterialQueries(
  queryClient: QueryClient,
  itemId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: inventoryKeys.rawMaterials() }),
    queryClient.invalidateQueries({
      queryKey: inventoryKeys.rawMaterialSummary(itemId),
    }),
    queryClient.invalidateQueries({
      queryKey: inventoryKeys.rawMaterialBatches(itemId),
    }),
    queryClient.invalidateQueries({ queryKey: inventoryKeys.snapshot() }),
    queryClient.invalidateQueries({ queryKey: reportsKeys.all }),
  ]);
}

export function useUpdateRawMaterialBatchStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, payload }: UpdateBatchStatusVariables) =>
      updateBatchStatus(batchId, payload),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: inventoryKeys.rawMaterialBatches(variables.itemId),
      });

      const previousBatches = queryClient.getQueryData(
        inventoryKeys.rawMaterialBatches(variables.itemId),
      );

      queryClient.setQueryData(
        inventoryKeys.rawMaterialBatches(variables.itemId),
        (current: unknown) =>
          Array.isArray(current)
            ? current.map((row) =>
                row &&
                typeof row === "object" &&
                "batch_id" in row &&
                (row as { batch_id: string }).batch_id === variables.batchId
                  ? {
                      ...row,
                      status: variables.payload.status,
                    }
                  : row,
              )
            : current,
      );

      return { previousBatches };
    },
    onError: (_error, variables, context) => {
      if (context?.previousBatches) {
        queryClient.setQueryData(
          inventoryKeys.rawMaterialBatches(variables.itemId),
          context.previousBatches,
        );
      }
    },
    onSuccess: async (_data, variables) => {
      await invalidateRawMaterialQueries(queryClient, variables.itemId);
    },
  });
}

export function useUpdateRawMaterialThreshold() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, threshold }: UpdateThresholdVariables) =>
      updateItemThreshold(itemId, threshold),
    onSuccess: async (_data, variables) => {
      await invalidateRawMaterialQueries(queryClient, variables.itemId);
    },
  });
}
