export interface InvoiceResponse {
  id: string;
  order_id: string;
  invoice_number: string;
  snapshot: InvoiceSnapshot;
  generated_by?: string;
  generated_at: string;
}

export interface InvoiceSnapshot {
  company: CompanySnapshot;
  customer: CustomerSnapshot;
  order_lines: OrderLineSnapshot[];
  taxes: TaxSnapshot;
  totals: TotalsSnapshot;
  payment_terms: PaymentTermsSnapshot;
}

export interface CompanySnapshot {
  company_name: string;
  gstin: string;
  phone: string;
  email: string;
  address: string;
  logo_url: string;
  bank_details: string;
}

export interface CustomerSnapshot {
  customer_id: string;
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  gstin: string;
}

export interface OrderLineSnapshot {
  item_id: string;
  item_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
}

export interface TaxSnapshot {
  cgst_percent: number;
  cgst_amount: number;
  sgst_percent: number;
  sgst_amount: number;
  igst_percent: number;
  igst_amount: number;
  total_tax: number;
}

export interface TotalsSnapshot {
  subtotal: number;
  total_tax: number;
  grand_total: number;
}

export interface PaymentTermsSnapshot {
  terms_days: number;
  footer_note: string;
  declaration_text: string;
}
