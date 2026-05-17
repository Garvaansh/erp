// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderDetailPage } from "@/features/orders/components/order-detail-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/orders/hooks/use-orders", () => ({
  useOrderDetail: () => ({
    isLoading: false,
    data: {
      id: "order-1",
      order_number: "SO-260517-001",
      status: "RESERVED",
      notes: "",
      order_date: "2026-05-17T10:00:00Z",
      reserved_at: "2026-05-17T10:05:00Z",
      created_at: "2026-05-17T10:00:00Z",
      updated_at: "2026-05-17T10:05:00Z",
      total_qty: 25,
      reserved_qty: 25,
      dispatched_qty: 0,
      customer: {
        id: "customer-1",
        display_name: "Acme Industries",
        company_name: "Acme Industries Pvt Ltd",
        phone_number: "9876543210",
      },
      lines: [
        {
          id: "line-1",
          finished_good_item_id: "fg-1",
          item_sku: "FG-001",
          item_name: "Bundle Wire",
          ordered_qty: 25,
          reserved_qty: 25,
          dispatched_qty: 0,
          unit_price: 120,
          line_total: 3000,
          created_at: "2026-05-17T10:00:00Z",
        },
      ],
      allocations: [
        {
          id: "alloc-1",
          sales_order_line_id: "line-1",
          inventory_batch_id: "batch-1",
          batch_code: "BNDL-260517-001",
          reserved_qty: 25,
          dispatched_qty: 0,
          status: "RESERVED",
          reserved_at: "2026-05-17T10:05:00Z",
        },
      ],
    },
  }),
  useOrderAllocations: () => ({
    data: [
      {
        id: "alloc-1",
        sales_order_line_id: "line-1",
        inventory_batch_id: "batch-1",
        batch_code: "BNDL-260517-001",
        reserved_qty: 25,
        dispatched_qty: 0,
        status: "RESERVED",
        reserved_at: "2026-05-17T10:05:00Z",
      },
    ],
  }),
}));

vi.mock("@/features/orders/hooks/use-order-mutations", () => ({
  useDispatchOrder: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  useCancelOrder: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
}));

function renderDetailPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <OrderDetailPage orderId="order-1" />
    </QueryClientProvider>,
  );
}

describe("OrderDetailPage", () => {
  it("renders order detail, allocation table, and status badges", () => {
    renderDetailPage();

    expect(screen.getByText("SO-260517-001")).toBeTruthy();
    expect(screen.getAllByText("RESERVED")[0]).toBeTruthy();
    expect(screen.getByText("BNDL-260517-001")).toBeTruthy();
    expect(screen.getByText("Bundle Wire")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dispatch" })).toBeTruthy();
  });
});
