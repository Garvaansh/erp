// ── Inventory Report ──
export type InventoryReportRow = {
  item_id: string;
  sku: string;
  name: string;
  category: string;
  total_qty: number;
  available_qty: number;
  reserved_qty: number;
  min_qty: number;
  max_qty: number;
  is_low_stock: boolean;
  batch_count: number;
};

export type InventoryMovementRow = {
  date: string;
  direction: string;
  total_qty: number;
  tx_count: number;
};

export type InventoryReport = {
  stock_on_hand: InventoryReportRow[];
  movement_by_day: InventoryMovementRow[];
  total_items: number;
  low_stock_count: number;
  total_stock_qty: number;
};

// ── Purchase Report ──
export type PurchaseReportRow = {
  vendor_name: string;
  total_orders: number;
  pending_pos: number;
  delivered_pos: number;
  total_value: number;
  total_qty: number;
};

export type PurchaseTimelineRow = {
  date: string;
  order_count: number;
  total_value: number;
};

export type PurchaseReport = {
  by_vendor: PurchaseReportRow[];
  timeline: PurchaseTimelineRow[];
  total_orders: number;
  total_pending: number;
  total_value: number;
};

// ── Users Report ──
export type UserReportRow = {
  user_id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export type UsersReport = {
  users: UserReportRow[];
  total_users: number;
  active_users: number;
  admin_count: number;
  worker_count: number;
};

export type ReportTab = "inventory" | "purchase" | "users";
