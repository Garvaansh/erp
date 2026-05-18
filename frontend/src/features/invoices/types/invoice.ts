export interface InvoiceCompany {
  company_name: string;
  gstin: string;
  phone: string;
  email: string;
  address: string;
  logo_url: string;
  bank_details: string;
}

export interface InvoiceCustomer {
  customer_name: string;
  gstin: string;
  address: string;
  phone: string;
  email: string;
  place_of_supply?: string;
  state_code?: string;
}

export interface InvoiceLineItem {
  description: string;
  hsn_sac: string;
  qty: number;
  unit: string;
  rate: number;
  tax_percent: number;
  amount: number;
}

export interface InvoiceTaxBreakdown {
  cgst_percent: number;
  cgst_amount: number;
  sgst_percent: number;
  sgst_amount: number;
  igst_percent: number;
  igst_amount: number;
  total_tax: number;
}

export interface InvoiceTotals {
  subtotal: number;
  taxable_amount: number;
  total_tax: number;
  grand_total: number;
  amount_in_words: string;
}

export interface InvoiceDocument {
  invoice_number: string;
  invoice_date: string;   // ISO date string
  due_date: string;       // ISO date string
  payment_terms_days: number;

  company: InvoiceCompany;
  customer: InvoiceCustomer;
  line_items: InvoiceLineItem[];
  taxes: InvoiceTaxBreakdown;
  totals: InvoiceTotals;

  footer_note: string;
  declaration_text: string;
  invoice_prefix: string;
}
