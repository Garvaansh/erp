/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BusinessSettingsForm } from "../components/business-settings-form";
import { InvoiceSettingsForm } from "../components/invoice-settings-form";
import { WhatsappSettingsForm } from "../components/whatsapp-settings-form";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getBusinessSettings, getInvoiceSettings, getWhatsappSettings, updateBusinessSettings } from "../api";
import React from "react";

// Mock the API calls
vi.mock("../api", () => ({
  getBusinessSettings: vi.fn(),
  updateBusinessSettings: vi.fn(),
  getInvoiceSettings: vi.fn(),
  updateInvoiceSettings: vi.fn(),
  getWhatsappSettings: vi.fn(),
  updateWhatsappSettings: vi.fn(),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithClient(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("Settings Forms", () => {
  it("renders business settings form and validates", async () => {
    vi.mocked(getBusinessSettings).mockResolvedValue({
      company_name: "Test Co",
      gstin: "29ABCDE1234F1Z5",
      phone: "1234567890",
      email: "test@example.com",
      address: "123 Test St",
      logo_url: "",
      bank_details: "Bank Info",
    });

    renderWithClient(<BusinessSettingsForm />);

    expect(await screen.findByText("Test Co")).toBeTruthy();

    const user = userEvent.setup();
    const editButton = screen.getByRole("button", { name: /Edit Profile/i });
    await user.click(editButton);

    const companyInput = screen.getByDisplayValue("Test Co");
    
    // Enter a valid value
    await user.clear(companyInput);
    await user.type(companyInput, "New Co");
    
    // Submit
    const submitButton = screen.getByRole("button", { name: /Save Changes/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(updateBusinessSettings).toHaveBeenCalled();
    });
  });

  it("renders invoice settings form", async () => {
    vi.mocked(getInvoiceSettings).mockResolvedValue({
      invoice_prefix: "INV-",
      default_payment_terms_days: 30,
      footer_note: "Thanks",
      declaration_text: "Dec",
      default_cgst_percent: 9,
      default_sgst_percent: 9,
    });

    renderWithClient(<InvoiceSettingsForm />);
    expect(await screen.findByText("INV-")).toBeTruthy();
  });

  it("renders whatsapp settings form", async () => {
    vi.mocked(getWhatsappSettings).mockResolvedValue({
      enabled: false,
      business_phone: "",
      default_template: "",
    });

    renderWithClient(<WhatsappSettingsForm />);
    expect(await screen.findByText("Setup WhatsApp Integration")).toBeTruthy();
  });
});
