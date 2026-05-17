export const ordersKeys = {
  all: ["orders"] as const,
  list: (params: {
    page: number;
    pageSize: number;
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) =>
    [
      ...ordersKeys.all,
      "list",
      params.page,
      params.pageSize,
      params.status ?? "",
      params.search ?? "",
      params.dateFrom ?? "",
      params.dateTo ?? "",
    ] as const,
  detail: (orderId: string) => [...ordersKeys.all, "detail", orderId] as const,
  allocations: (orderId: string) =>
    [...ordersKeys.all, "allocations", orderId] as const,
  customerSearch: (query: string) =>
    [...ordersKeys.all, "customer-search", query.trim()] as const,
  finishedGoodReservations: (itemId: string) =>
    [...ordersKeys.all, "finished-good-reservations", itemId] as const,
  batchReservations: (batchCode: string) =>
    [...ordersKeys.all, "batch-reservations", batchCode.trim()] as const,
};
