// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  render,
  renderHook,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const inventoryState = vi.hoisted(() => ({
  batchStatus: "ACTIVE" as "ACTIVE" | "HOLD" | "EXHAUSTED" | "REVERSED",
  updateBatchStatus: vi.fn().mockResolvedValue(undefined),
  updateItemThreshold: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/inventory/raw-materials/ITEM-1",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/inventory", () => ({
  updateBatchStatus: inventoryState.updateBatchStatus,
  updateItemThreshold: inventoryState.updateItemThreshold,
  getRawMaterialSummary: vi.fn(),
  getRawMaterialBatches: vi.fn(),
}));

vi.mock("@/features/inventory/queries", () => ({
  useRawMaterialSummary: () => ({
    data: {
      item_id: "ITEM-1",
      sku: "RM-001",
      name: "Raw Coil",
      specification: "1.2mm",
      specs: {},
      available_qty: 80,
      reserved_qty: 10,
      hold_qty: 5,
      pending_deliveries: 0,
      threshold: 20,
    },
    isLoading: false,
    isError: false,
  }),
  useRawMaterialBatches: () => ({
    data: [
      {
        batch_id: "BATCH-1",
        batch_code: "BATCH-1",
        vendor_name: "Vendor A",
        po_number: "PO-1",
        parent_po_id: null,
        received_at: "2026-05-08T00:00:00Z",
        initial_qty: 100,
        remaining_qty: 80,
        reserved_qty: 10,
        available_qty: 70,
        status: inventoryState.batchStatus,
      },
    ],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/lib/export/export-xlsx", () => ({
  exportReportToXlsx: vi.fn(),
}));

vi.mock("@/lib/export/export-pdf", () => ({
  exportReportToPdf: vi.fn(),
}));

vi.mock("@/features/procurement/api", () => ({
  reverseReceipt: vi.fn().mockResolvedValue(undefined),
}));

import { RawMaterialDetailPage } from "@/app/(dashboard)/inventory/raw-materials/components/raw-material-detail-page";
import { useUpdateRawMaterialBatchStatus } from "@/features/inventory/mutations";
import { inventoryKeys, reportsKeys } from "@/lib/react-query/keys";

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { ...render(ui, { wrapper }), queryClient };
}

function renderBatchStatusHook() {
  const queryClient = new QueryClient();
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const result = renderHook(() => useUpdateRawMaterialBatchStatus(), {
    wrapper,
  });
  return { ...result, queryClient, invalidateSpy };
}

beforeEach(() => {
  vi.clearAllMocks();
  inventoryState.batchStatus = "ACTIVE";
});

describe("hold batch flow", () => {
  it("hold button mutation test", async () => {
    renderWithQueryClient(<RawMaterialDetailPage itemId="ITEM-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Place on HOLD" }));

    await waitFor(() => {
      expect(inventoryState.updateBatchStatus).toHaveBeenCalledWith("BATCH-1", {
        status: "HOLD",
      });
    });
  });

  it("cache invalidation test", async () => {
    const { result, invalidateSpy } = renderBatchStatusHook();

    await result.current.mutateAsync({
      batchId: "BATCH-1",
      itemId: "ITEM-1",
      payload: { status: "HOLD" },
    });

    expect(inventoryState.updateBatchStatus).toHaveBeenCalledWith("BATCH-1", {
      status: "HOLD",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: inventoryKeys.rawMaterials(),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: inventoryKeys.rawMaterialSummary("ITEM-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: inventoryKeys.rawMaterialBatches("ITEM-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: inventoryKeys.snapshot(),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: reportsKeys.all,
    });
  });

  it("status badge update test", () => {
    inventoryState.batchStatus = "HOLD";

    renderWithQueryClient(<RawMaterialDetailPage itemId="ITEM-1" />);

    expect(screen.getByText("HOLD")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reactivate" })).toBeTruthy();
  });
});
