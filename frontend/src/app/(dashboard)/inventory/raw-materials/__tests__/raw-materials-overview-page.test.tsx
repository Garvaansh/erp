// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RawMaterialsOverviewPage } from "@/app/(dashboard)/inventory/raw-materials/components/raw-materials-overview-page";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/features/inventory/queries", () => ({
  useRawMaterialMaster: () => ({
    isLoading: false,
    data: [
      {
        item_id: "item-1",
        sku: "RMSS002",
        name: "Stainless Steel",
        specification: "1.5mm × 1000mm",
        specs: { thickness_mm: 1.5, width_mm: 1000 },
        available_qty: 500,
        reserved_qty: 25,
        threshold: 600,
        pending_deliveries: 200,
        status: "LOW",
      },
    ],
  }),
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

describe("RawMaterialsOverviewPage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    pushMock.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("renders dense raw material rows with threshold-driven status badges", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <RawMaterialsOverviewPage />
      </QueryClientProvider>
    );

    expect(screen.getByText("RMSS002")).toBeTruthy();
    expect(screen.getByText("1.5mm × 1000mm")).toBeTruthy();
    expect(screen.getByText("LOW")).toBeTruthy();
    expect(screen.getByText("200 kg")).toBeTruthy();
  });

  it("routes to the dedicated detail page on row click", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <RawMaterialsOverviewPage />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getAllByText("Stainless Steel")[0]);

    expect(pushMock).toHaveBeenCalledWith("/inventory/raw-materials/item-1");
  });
});
