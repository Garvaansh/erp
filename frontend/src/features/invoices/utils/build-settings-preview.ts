/**
 * Builds a realistic sample InvoiceDocument from settings values.
 * Used exclusively in the settings live preview.
 */
import { InvoiceDocument } from "@/features/invoices/types/invoice";
import { amountToWords, addDays } from "@/features/invoices/utils/invoice-utils";

interface SettingsPreviewParams {
  // Business settings
  companyName: string;
  gstin: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
  bankDetails: string;
  // Invoice settings
  invoicePrefix: string;
  paymentTermsDays: number;
  cgstPercent: number;
  sgstPercent: number;
  footerNote: string;
  declarationText: string;
}

export function buildSettingsPreviewDocument(params: SettingsPreviewParams): InvoiceDocument {
  const today = new Date().toISOString();
  const subtotal = 5000;
  const cgstAmt = subtotal * (params.cgstPercent / 100);
  const sgstAmt = subtotal * (params.sgstPercent / 100);
  const totalTax = cgstAmt + sgstAmt;
  const grandTotal = subtotal + totalTax;

  return {
    invoice_number: `${params.invoicePrefix || "INV-"}2026-00014`,
    invoice_date: today,
    due_date: addDays(today, params.paymentTermsDays || 30),
    payment_terms_days: params.paymentTermsDays || 30,

    company: {
      company_name: params.companyName || "Your Company Name",
      gstin: params.gstin || "27AABCU9603R1ZX",
      phone: params.phone || "+91 98765 43210",
      email: params.email || "accounts@yourcompany.com",
      address: params.address || "Plot 14, Industrial Area Phase 2,\nPune, Maharashtra – 411 018",
      logo_url: params.logoUrl || "",
      bank_details: params.bankDetails || "State Bank of India\nA/C: 123456789012\nIFSC: SBIN0001234\nBranch: Industrial Estate",
    },

    customer: {
      customer_name: "Acme Manufacturing Ltd",
      gstin: "27AABCM1234P1ZD",
      address: "Unit 5, MIDC Area,\nNashik, Maharashtra – 422 010",
      phone: "+91 92345 67890",
      email: "purchase@acmemfg.in",
      place_of_supply: "Maharashtra (27)",
    },

    line_items: [
      {
        description: "Premium Moulding Compound – Grade A",
        hsn_sac: "3907",
        qty: 100,
        unit: "Kg",
        rate: 35.00,
        tax_percent: (params.cgstPercent + params.sgstPercent),
        amount: 3500,
      },
      {
        description: "Polishing Services – Monthly Contract",
        hsn_sac: "9988",
        qty: 1,
        unit: "Job",
        rate: 1500.00,
        tax_percent: (params.cgstPercent + params.sgstPercent),
        amount: 1500,
      },
    ],

    taxes: {
      cgst_percent: params.cgstPercent,
      cgst_amount: cgstAmt,
      sgst_percent: params.sgstPercent,
      sgst_amount: sgstAmt,
      igst_percent: 0,
      igst_amount: 0,
      total_tax: totalTax,
    },

    totals: {
      subtotal,
      taxable_amount: subtotal,
      total_tax: totalTax,
      grand_total: grandTotal,
      amount_in_words: amountToWords(grandTotal),
    },

    footer_note: params.footerNote || "This is a computer-generated invoice.",
    declaration_text: params.declarationText || "",
    invoice_prefix: params.invoicePrefix || "INV-",
  };
}
