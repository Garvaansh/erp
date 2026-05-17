// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCreateOrder,
  useDispatchOrder,
} from "@/features/orders/hooks/use-order-mutations";
import { inventoryKeys } from "@/lib/react-query/keys";
import { ordersKeys } from "@/features/orders/hooks/ordersKeys";

const apiMocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  dispatchOrder: vi.fn(),
  cancelOrder: vi.fn(),
  createCustomer: vi.fn(),
}));

vi.mock("@/features/orders/api/orders", () => ({
  createOrder: apiMocks.createOrder,
  dispatchOrder: apiMocks.dispatchOrder,
  cancelOrder: apiMocks.cancelOrder,
  createCustomer: apiMocks.createCustomer,
}));

function wrapperWithClient(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("order mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates order and reservation queries after create", async () => {
    apiMocks.createOrder.mockResolvedValue({
      order: {
        id: "order-1",
        lines: [
          {
            id: "line-1",
            finished_good_item_id: "fg-1",
          },
        ],
        allocations: [
          {
            id: "alloc-1",
            batch_code: "BNDL-001",
          },
        ],
      },
    });

    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateOrder(), {
      wrapper: wrapperWithClient(queryClient),
    });

    await result.current.mutateAsync({
      customer_id: "customer-1",
      lines: [
        {
          finished_good_item_id: "fg-1",
          ordered_qty: 10,
          unit_price: 100,
        },
      ],
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ordersKeys.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ordersKeys.detail("order-1"),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: inventoryKeys.finishedGoodDetail("fg-1"),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ordersKeys.batchReservations("BNDL-001"),
      });
    });
  });

  it("invalidates order detail after dispatch", async () => {
    apiMocks.dispatchOrder.mockResolvedValue({
      order: {
        id: "order-1",
        lines: [
          {
            id: "line-1",
            finished_good_item_id: "fg-1",
          },
        ],
        allocations: [],
      },
    });

    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDispatchOrder(), {
      wrapper: wrapperWithClient(queryClient),
    });

    await result.current.mutateAsync({
      orderId: "order-1",
      payload: {
        notes: "",
        lines: [
          {
            sales_order_line_id: "line-1",
            dispatch_qty: 5,
          },
        ],
      },
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ordersKeys.detail("order-1"),
      });
    });
  });
});
