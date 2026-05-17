import { useQuery } from "@tanstack/react-query";
import {
  getBatchReservations,
  getFinishedGoodReservations,
  getOrderAllocations,
  getOrderDetail,
  getOrders,
  searchCustomers,
  type OrdersListParams,
} from "@/features/orders/api/orders";
import { ordersKeys } from "@/features/orders/hooks/ordersKeys";

export function useOrdersList(params: OrdersListParams) {
  return useQuery({
    queryKey: ordersKeys.list({
      page: params.page ?? 1,
      pageSize: params.page_size ?? 20,
      status: params.status,
      search: params.search,
      dateFrom: params.date_from,
      dateTo: params.date_to,
    }),
    queryFn: () => getOrders(params),
    staleTime: 15_000,
  });
}

export function useOrderDetail(orderId: string) {
  return useQuery({
    queryKey: ordersKeys.detail(orderId),
    queryFn: () => getOrderDetail(orderId),
    enabled: Boolean(orderId.trim()),
    staleTime: 15_000,
  });
}

export function useOrderAllocations(orderId: string) {
  return useQuery({
    queryKey: ordersKeys.allocations(orderId),
    queryFn: () => getOrderAllocations(orderId),
    enabled: Boolean(orderId.trim()),
    staleTime: 15_000,
  });
}

export function useCustomerSearch(query: string) {
  return useQuery({
    queryKey: ordersKeys.customerSearch(query),
    queryFn: () => searchCustomers(query),
    enabled: query.trim().length >= 2,
    staleTime: 10_000,
  });
}

export function useFinishedGoodReservations(itemId: string) {
  return useQuery({
    queryKey: ordersKeys.finishedGoodReservations(itemId),
    queryFn: () => getFinishedGoodReservations(itemId),
    enabled: Boolean(itemId.trim()),
    staleTime: 10_000,
  });
}

export function useBatchReservations(batchCode: string) {
  return useQuery({
    queryKey: ordersKeys.batchReservations(batchCode),
    queryFn: () => getBatchReservations(batchCode),
    enabled: Boolean(batchCode.trim()),
    staleTime: 10_000,
  });
}
