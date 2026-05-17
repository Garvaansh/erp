// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api/api-client";
import { NewOrderWorkspace } from "@/features/orders/components/new-order-workspace";
import { useOrderDraftStore } from "@/features/orders/stores/order-draft-store";
import userEvent from "@testing-library/user-event";

const pushMock = vi.fn();
const createOrderMock = vi.fn();
const createCustomerMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/features/inventory/queries", () => ({
  useFinishedGoodsMaster: () => ({
    isLoading: false,
    data: [
      {
        item_id: "fg-1",
        sku: "FG-001",
        name: "Bundle Wire",
        diameter: 3,
        available_qty: 28,
        reserved_qty: 5,
        status: "OK",
      },
    ],
  }),
}));

vi.mock("@/features/orders/hooks/use-orders", () => ({
  useCustomerSearch: () => ({
    isFetching: false,
    data: {
      items: [
        {
          id: "customer-1",
          display_name: "Acme Industries",
          company_name: "Acme Industries Pvt Ltd",
          phone_number: "9876543210",
          match_source: "phone",
          matched_value: "9876543210",
          confidence: {
            score: 0.98,
            level: "high",
            reason: "Phone match",
          },
        },
      ],
    },
  }),
}));

vi.mock("@/features/orders/hooks/use-order-mutations", () => ({
  useCreateOrder: () => ({
    isPending: false,
    mutateAsync: (...args: unknown[]) => createOrderMock(...args),
  }),
  useCreateCustomer: () => ({
    isPending: false,
    mutateAsync: (...args: unknown[]) => createCustomerMock(...args),
  }),
}));

function renderWorkspace() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <NewOrderWorkspace />
    </QueryClientProvider>,
  );
}

describe("NewOrderWorkspace", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useOrderDraftStore.getState().reset();
    createOrderMock.mockResolvedValue({
      order: { id: "order-1" },
    });
    createCustomerMock.mockResolvedValue({
      resolution: "create_new_customer",
      customer: {
        id: "customer-2",
        display_name: "New Customer",
        company_name: "",
        phone_number: "9999999999",
        whatsapp_number: "",
        email: "",
        gst_number: "",
        notes: "",
        is_active: true,
        created_at: "",
        updated_at: "",
      },
    });
  });

  it("supports customer selection, line editing, and summary calculation", async () => {
    renderWorkspace();

    fireEvent.focus(
      screen.getByPlaceholderText("Search customer name, phone, or GST"),
    );
    fireEvent.click(screen.getByText("Acme Industries"));

    fireEvent.focus(screen.getByPlaceholderText("Search finished goods"));
    fireEvent.click(screen.getByText("FG-001 · Bundle Wire"));

    const user = userEvent.setup();
    const numberInputs = screen.getAllByRole("spinbutton");
    await user.clear(numberInputs[0]);
    await user.type(numberInputs[0], "10");
    await user.clear(numberInputs[1]);
    await user.type(numberInputs[1], "120");

    await waitFor(() => {
      expect(screen.getAllByText("₹1,200.00").length).toBeGreaterThan(0);
      expect(
        screen.getByText(/will be reserved from available finished inventory/i),
      ).toBeTruthy();
    });
  });

  it("renders inline duplicate-customer guidance for 409 responses", async () => {
    createCustomerMock.mockRejectedValue(
      new ApiClientError("Customer identity requires review", 409, {
        matches: [
          {
            id: "customer-9",
            display_name: "Probable Match",
            company_name: "Probable Match Pvt Ltd",
            phone_number: "8888888888",
            match_source: "phone",
            matched_value: "8888888888",
            confidence: {
              score: 0.92,
              level: "high",
              reason: "Phone match",
            },
          },
        ],
      }),
    );

    renderWorkspace();

    fireEvent.change(screen.getByPlaceholderText("Customer or company name"), {
      target: { value: "Probable Match" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Customer" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Possible existing customers found. Please verify before creating a new customer.",
        ),
      ).toBeTruthy();
      expect(screen.getByText("Probable Match")).toBeTruthy();
    });
  });

  it("shows inline stock warning when requested quantity exceeds known availability", async () => {
    renderWorkspace();

    fireEvent.focus(
      screen.getByPlaceholderText("Search customer name, phone, or GST"),
    );
    fireEvent.click(screen.getByText("Acme Industries"));

    fireEvent.focus(screen.getByPlaceholderText("Search finished goods"));
    fireEvent.click(screen.getByText("FG-001 · Bundle Wire"));

    const user = userEvent.setup();
    const numberInputs = screen.getAllByRole("spinbutton");
    await user.clear(numberInputs[0]);
    await user.type(numberInputs[0], "35");

    await waitFor(() => {
      expect(screen.getByText(/Only 28/)).toBeTruthy();
    });
  });
});
