export type PayablePOStatus = "UNPAID" | "PARTIAL" | "PAID";

export type PayablePO = {
  po_id: string;
  po_number: string;
  status: PayablePOStatus;
  total_value: number;
  paid: number;
  due: number;
  last_payment_date: string | null;
};

export type PayableVendor = {
  vendor_id: string;
  vendor_name: string;
  vendor_code: string;
  total_purchased: number;
  total_paid: number;
  total_due: number;
  unpaid_pos: PayablePO[];
};

export type PayablesResponse = PayableVendor[];

export type LogPaymentPayload = {
  po_id: string;
  amount: number;
  payment_date?: string;
  note?: string;
};

export type LogPaymentResponse = {
  payment?: {
    id?: string;
    po_id?: string;
    amount?: number;
    payment_date?: string;
    note?: string;
    created_by?: string;
    created_at?: string;
  };
  summary?: {
    total_value?: number;
    paid_amount?: number;
    due_amount?: number;
    payment_status?: PayablePOStatus;
  };
};
