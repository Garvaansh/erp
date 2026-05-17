import { apiClient } from "@/lib/api/api-client";
import type {
  BatchReservationDrillDown,
  CustomerCreateResponse,
  CustomerSearchPage,
  DraftCustomerInput,
  FinishedGoodReservationVisibility,
  OrderAllocationView,
  OrderCreateInput,
  OrderDetail,
  OrderDispatchInput,
  OrderListPage,
  OrderMutationResponse,
} from "@/features/orders/types";

export type OrdersListParams = {
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
};

export async function getOrders(
  params: OrdersListParams = {},
): Promise<OrderListPage> {
  const search = new URLSearchParams();
  if (params.page) {
    search.set("page", String(params.page));
  }
  if (params.page_size) {
    search.set("page_size", String(params.page_size));
  }
  if (params.status?.trim()) {
    search.set("status", params.status.trim());
  }
  if (params.search?.trim()) {
    search.set("search", params.search.trim());
  }
  if (params.date_from?.trim()) {
    search.set("date_from", params.date_from.trim());
  }
  if (params.date_to?.trim()) {
    search.set("date_to", params.date_to.trim());
  }

  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return apiClient<OrderListPage>(`/orders${suffix}`, { method: "GET" });
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail> {
  return apiClient<OrderDetail>(`/orders/${orderId.trim()}`, { method: "GET" });
}

export async function getOrderAllocations(
  orderId: string,
): Promise<OrderAllocationView[]> {
  return apiClient<OrderAllocationView[]>(`/orders/${orderId.trim()}/allocations`, {
    method: "GET",
  });
}

export async function createOrder(
  payload: OrderCreateInput,
): Promise<OrderMutationResponse> {
  return apiClient<OrderMutationResponse>("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function dispatchOrder(
  orderId: string,
  payload: OrderDispatchInput,
): Promise<OrderMutationResponse> {
  return apiClient<OrderMutationResponse>(`/orders/${orderId.trim()}/dispatch`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelOrder(
  orderId: string,
  reason: string,
): Promise<OrderMutationResponse> {
  return apiClient<OrderMutationResponse>(`/orders/${orderId.trim()}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function searchCustomers(query: string): Promise<CustomerSearchPage> {
  const params = new URLSearchParams({ q: query.trim(), page: "1", page_size: "8" });
  return apiClient<CustomerSearchPage>(`/customers/search?${params.toString()}`, {
    method: "GET",
  });
}

export async function createCustomer(
  payload: DraftCustomerInput,
): Promise<CustomerCreateResponse> {
  return apiClient<CustomerCreateResponse>("/customers", {
    method: "POST",
    body: JSON.stringify({
      display_name: payload.display_name,
      phone_number: payload.phone_number,
      gst_number: payload.gst_number,
    }),
  });
}

export async function getFinishedGoodReservations(
  itemId: string,
): Promise<FinishedGoodReservationVisibility> {
  return apiClient<FinishedGoodReservationVisibility>(
    `/inventory/finished-goods/${itemId.trim()}/reservations`,
    { method: "GET" },
  );
}

export async function getBatchReservations(
  batchCode: string,
): Promise<BatchReservationDrillDown> {
  return apiClient<BatchReservationDrillDown>(
    `/inventory/batches/${encodeURIComponent(batchCode.trim())}/reservations`,
    { method: "GET" },
  );
}
