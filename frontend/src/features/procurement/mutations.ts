import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  closeOrder,
  createPurchaseOrder,
  receiveGoods,
  reverseReceipt,
  updatePurchaseOrder,
} from "@/features/procurement/api";
import type {
  CloseOrderPayload,
  CreatePurchaseOrderPayload,
  ReceiveGoodsPayload,
  ReverseReceiptPayload,
  UpdatePurchaseOrderPayload,
} from "@/features/procurement/types";
import { procurementKeys } from "@/lib/react-query/keys";

export type UpdatePurchaseOrderVariables = {
  id: string;
  payload: UpdatePurchaseOrderPayload;
};

export type ReceiveGoodsVariables = {
  id: string;
  payload: ReceiveGoodsPayload;
};

export type ReverseReceiptVariables = {
  id: string;
  payload: ReverseReceiptPayload;
};

export type CloseOrderVariables = {
  id: string;
  payload: CloseOrderPayload;
};

async function invalidateProcurementQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: procurementKeys.all });
}

export function createPurchaseOrderMutationOptions(queryClient: QueryClient) {
  return {
    mutationFn: (payload: CreatePurchaseOrderPayload) =>
      createPurchaseOrder(payload),
    onSuccess: async () => {
      await invalidateProcurementQueries(queryClient);
    },
  };
}

export function updatePurchaseOrderMutationOptions(queryClient: QueryClient) {
  return {
    mutationFn: ({ id, payload }: UpdatePurchaseOrderVariables) =>
      updatePurchaseOrder(id, payload),
    onSuccess: async () => {
      await invalidateProcurementQueries(queryClient);
    },
  };
}

export function receiveGoodsMutationOptions(queryClient: QueryClient) {
  return {
    mutationFn: ({ id, payload }: ReceiveGoodsVariables) =>
      receiveGoods(id, payload),
    onSuccess: async () => {
      await invalidateProcurementQueries(queryClient);
    },
  };
}

export function reverseReceiptMutationOptions(queryClient: QueryClient) {
  return {
    mutationFn: ({ id, payload }: ReverseReceiptVariables) =>
      reverseReceipt(id, payload),
    onSuccess: async () => {
      await invalidateProcurementQueries(queryClient);
    },
  };
}

export function closeOrderMutationOptions(queryClient: QueryClient) {
  return {
    mutationFn: ({ id, payload }: CloseOrderVariables) =>
      closeOrder(id, payload),
    onSuccess: async () => {
      await invalidateProcurementQueries(queryClient);
    },
  };
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation(createPurchaseOrderMutationOptions(queryClient));
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation(updatePurchaseOrderMutationOptions(queryClient));
}

export function useReceiveGoods() {
  const queryClient = useQueryClient();
  return useMutation(receiveGoodsMutationOptions(queryClient));
}

export function useReverseReceipt() {
  const queryClient = useQueryClient();
  return useMutation(reverseReceiptMutationOptions(queryClient));
}

export function useCloseOrder() {
  const queryClient = useQueryClient();
  return useMutation(closeOrderMutationOptions(queryClient));
}
