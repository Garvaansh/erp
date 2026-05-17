// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RawMaterialDetailPage } from "@/app/(dashboard)/inventory/raw-materials/components/raw-material-detail-page";

const replaceMock = vi.fn();
const batchStatusMutateMock = vi.fn();
const thresholdMutateAsyncMock = vi.fn();
const reverseReceiptMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: vi.fn(),
  }),
  usePathname: () => "/inventory/raw-materials/item-1",
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/features/inventory/queries", () => ({
  useRawMaterialSummary: () => ({
    data: {
      item_id: "item-1",
      sku: "RMSS002",
      name: "Stainless Steel",
      specification: "1.5mm × 1000mm",
      specs: { thickness_mm: 1.5, width_mm: 1000 },
      available_qty: 500,
      reserved_qty: 50,
      hold_qty: 100,
      pending_deliveries: 200,
      threshold: 600,
    },
  }),
  useRawMaterialBatches: () => ({
    isLoading: false,
    data: [
      {
        batch_id: "batch-1",
        batch_code: "BAT260506-001",
        vendor_name: "Meow Metals",
        po_number: "PO-MEOW-260505-001",
        parent_po_id: "po-1",
        received_at: "2026-05-06T00:00:00Z",
        initial_qty: 100,
        remaining_qty: 90,
        reserved_qty: 10,
        available_qty: 80,
        status: "ACTIVE",
      },
    ],
  }),
}));

vi.mock("@/features/inventory/mutations", () => ({
  useUpdateRawMaterialBatchStatus: () => ({
    mutate: batchStatusMutateMock,
  }),
  useUpdateRawMaterialThreshold: () => ({
    mutateAsync: thresholdMutateAsyncMock,
  }),
}));

vi.mock("@/features/procurement/api", () => ({
  reverseReceipt: (...args: unknown[]) => reverseReceiptMock(...args),
}));

vi.mock("@/lib/export/export-xlsx", () => ({
  exportReportToXlsx: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/export/export-pdf", () => ({
  exportReportToPdf: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <RawMaterialDetailPage itemId="item-1" />
    </QueryClientProvider>,
  );
}

describe("RawMaterialDetailPage", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    batchStatusMutateMock.mockReset();
    thresholdMutateAsyncMock.mockReset();
    reverseReceiptMock.mockReset();
  });

  it("renders the batch ledger, export actions, and procurement link", () => {
    renderPage();

    expect(screen.getByText("BAT260506-001")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export Excel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export PDF" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "PO-MEOW-260505-001" }).getAttribute("href"),
    ).toBe("/procurement/po-1");
  });

  it("sends HOLD action through the row action mutation", () => {
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: "Place on HOLD" })[0]);

    expect(batchStatusMutateMock).toHaveBeenCalledWith({
      batchId: "batch-1",
      itemId: "item-1",
      payload: {
        status: "HOLD",
      },
    });
  });
});
