export type Vendor = {
  id: string;
  name: string;
  code: string;
  contact_person: string;
  phone: string;
  email: string;
  gstin: string;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type CreateVendorPayload = {
  name: string;
  code: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  notes?: string;
};

export type UpdateVendorPayload = {
  name?: string;
  code?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  notes?: string;
  is_active?: boolean;
};

export type VendorSummary = {
  total_purchased: number;
  total_paid: number;
  total_due: number;
};

export type VendorProfilePO = {
  id: string;
  po_number: string;
  created_at: string;
};

export type VendorProfilePayment = {
  transaction_id: string;
  amount: number;
  payment_date: string;
  po_number: string;
};

export type VendorProfile = {
  vendor: Vendor;
  summary: VendorSummary;
  recent_pos: VendorProfilePO[];
  recent_payments: VendorProfilePayment[];
};
