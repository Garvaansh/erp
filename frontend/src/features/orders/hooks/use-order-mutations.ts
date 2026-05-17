import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  cancelOrder,
  createCustomer,
  createOrder,
  dispatchOrder,
} from "@/features/orders/api/orders";
import { ordersKeys } from "@/features/orders/hooks/ordersKeys";
import { inventoryKeys } from "@/lib/react-query/keys";
import type {
  DraftCustomerInput,
  OrderCreateInput,
  OrderDispatchInput,
  OrderMutationResponse,
} from "@/features/orders/types";

async function invalidateOrderState(
  queryClient: QueryClient,
  response?: OrderMutationResponse | null,
) {
  await queryClient.invalidateQueries({ queryKey: ordersKeys.all });

  const order = response?.order;
  if (!order) {
    return;
  }

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ordersKeys.detail(order.id) }),
    queryClient.invalidateQueries({ queryKey: ordersKeys.allocations(order.id) }),
  ]);

  for (const line of order.lines) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.finishedGoodDetail(line.finished_good_item_id),
      }),
      queryClient.invalidateQueries({
        queryKey: ordersKeys.finishedGoodReservations(line.finished_good_item_id),
      }),
    ]);
  }

  for (const allocation of order.allocations) {
    await queryClient.invalidateQueries({
      queryKey: ordersKeys.batchReservations(allocation.batch_code),
    });
  }
}

export function createOrderMutationOptions(queryClient: QueryClient) {
  return {
    mutationFn: (payload: OrderCreateInput) => createOrder(payload),
    onSuccess: async (response: OrderMutationResponse) => {
      await invalidateOrderState(queryClient, response);
    },
  };
}

export function dispatchOrderMutationOptions(queryClient: QueryClient) {
  return {
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: string;
      payload: OrderDispatchInput;
    }) => dispatchOrder(orderId, payload),
    onSuccess: async (response: OrderMutationResponse) => {
      await invalidateOrderState(queryClient, response);
    },
  };
}

export function cancelOrderMutationOptions(queryClient: QueryClient) {
  return {
    mutationFn: ({
      orderId,
      reason,
    }: {
      orderId: string;
      reason: string;
    }) => cancelOrder(orderId, reason),
    onSuccess: async (response: OrderMutationResponse) => {
      await invalidateOrderState(queryClient, response);
    },
  };
}

export function createCustomerMutationOptions(queryClient: QueryClient) {
  return {
    mutationFn: (payload: DraftCustomerInput) => createCustomer(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ordersKeys.customerSearch(""),
      });
    },
  };
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation(createOrderMutationOptions(queryClient));
}

export function useDispatchOrder() {
  const queryClient = useQueryClient();
  return useMutation(dispatchOrderMutationOptions(queryClient));
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation(cancelOrderMutationOptions(queryClient));
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation(createCustomerMutationOptions(queryClient));
}
