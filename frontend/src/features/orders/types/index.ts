export type OrderStatus =
  | "DRAFT"
  | "RESERVED"
  | "PARTIALLY_DISPATCHED"
  | "DISPATCHED"
  | "CANCELLED"
  | "CLOSED";

export type AllocationStatus =
  | "RESERVED"
  | "PARTIALLY_DISPATCHED"
  | "DISPATCHED"
  | "RELEASED";

export type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";

export type CustomerConfidence = {
  score: number;
  level: string;
  reason: string;
};

export type CustomerSearchResult = {
  id: string;
  display_name: string;
  company_name: string;
  phone_number: string;
  match_source: string;
  matched_value: string;
  confidence: CustomerConfidence;
};

export type CustomerSearchPage = {
  items: CustomerSearchResult[];
  page: number;
  page_size: number;
  total: number;
};

export type CustomerRecord = {
  id: string;
  display_name: string;
  company_name: string;
  phone_number: string;
  whatsapp_number: string;
  email: string;
  gst_number: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerCreateResponse = {
  resolution:
    | "exact_existing_customer"
    | "probable_matches"
    | "create_new_customer";
  customer?: CustomerRecord | null;
  matches?: CustomerSearchResult[];
};

export type OrderListRow = {
  id: string;
  order_number: string;
  customer_id: string;
  customer_display_name: string;
  customer_company_name: string;
  total_qty: number;
  reserved_qty: number;
  dispatched_qty: number;
  status: OrderStatus;
  order_date: string;
  payment_status?: PaymentStatus;
};

export type OrderListPage = {
  items: OrderListRow[];
  page: number;
  page_size: number;
};

export type OrderCustomerView = {
  id: string;
  display_name: string;
  company_name: string;
  phone_number: string;
};

export type OrderLineView = {
  id: string;
  finished_good_item_id: string;
  item_sku: string;
  item_name: string;
  ordered_qty: number;
  reserved_qty: number;
  dispatched_qty: number;
  unit_price: number;
  line_total: number;
  created_at: string;
};

export type OrderAllocationView = {
  id: string;
  sales_order_line_id: string;
  inventory_batch_id: string;
  batch_code: string;
  reserved_qty: number;
  dispatched_qty: number;
  status: AllocationStatus;
  reserved_at: string;
  dispatched_at?: string;
  released_at?: string;
};

export type OrderDetail = {
  id: string;
  order_number: string;
  status: OrderStatus;
  notes: string;
  order_date: string;
  reserved_at?: string;
  dispatched_at?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
  total_qty: number;
  reserved_qty: number;
  dispatched_qty: number;
  customer: OrderCustomerView;
  lines: OrderLineView[];
  allocations: OrderAllocationView[];
  payment_status?: PaymentStatus;
};

export type OrderMutationResponse = {
  order: OrderDetail | null;
};

export type OrderCreateLineInput = {
  finished_good_item_id: string;
  ordered_qty: number;
  unit_price?: number;
};

export type OrderCreateInput = {
  customer_id: string;
  notes?: string;
  lines: OrderCreateLineInput[];
};

export type OrderDispatchLineInput = {
  sales_order_line_id: string;
  dispatch_qty: number;
};

export type OrderDispatchInput = {
  notes?: string;
  lines: OrderDispatchLineInput[];
};

export type OrderCancelInput = {
  reason: string;
};

export type FinishedGoodReservationOrderView = {
  sales_order_id: string;
  order_number: string;
  order_status: OrderStatus;
  customer_id: string;
  customer_display_name: string;
  customer_company_name: string;
  reserved_qty: number;
  dispatched_qty: number;
  allocation_statuses: AllocationStatus[];
};

export type FinishedGoodReservationVisibility = {
  item_id: string;
  total_reserved: number;
  batches_involved: number;
  reserving_orders: number;
  reservations: FinishedGoodReservationOrderView[];
};

export type BatchReservationRow = {
  order_number: string;
  customer_display_name: string;
  customer_company_name: string;
  reserved_qty: number;
  dispatched_qty: number;
  allocation_status: AllocationStatus;
  reservation_date: string;
};

export type BatchReservationDrillDown = {
  batch_id: string;
  batch_code: string;
  item_id: string;
  item_name: string;
  reservations: BatchReservationRow[];
};

export type DraftCustomerInput = {
  display_name: string;
  phone_number: string;
  gst_number: string;
};

export type DraftLineInput = {
  key: string;
  finished_good_item_id: string;
  ordered_qty: number;
  unit_price: number;
};

export type OrderDraftState = {
  customer_query: string;
  selected_customer: CustomerSearchResult | null;
  draft_customer: DraftCustomerInput;
  notes: string;
  lines: DraftLineInput[];
  last_saved_at: string | null;
};
