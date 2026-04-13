export type Vendor = {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  payment_terms: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateVendorPayload = {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  payment_terms?: string;
};

export type UpdateVendorPayload = {
  name?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  payment_terms?: string;
  is_active?: boolean;
};
