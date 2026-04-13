export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

export const inventoryKeys = {
  all: ["inventory"] as const,
  snapshot: () => [...inventoryKeys.all, "snapshot"] as const,
  activeBatches: (itemId: string, batchType: string = "ALL") =>
    [...inventoryKeys.all, "active-batches", itemId, batchType] as const,
  selectableRawItems: () =>
    [...inventoryKeys.all, "selectable-raw-items"] as const,
};

export const wipKeys = {
  all: ["wip"] as const,
  selectableItems: (stage: "molding" | "polishing") =>
    [...wipKeys.all, "selectable-items", stage] as const,
  lots: (stage: "molding" | "polishing", itemId: string) =>
    [...wipKeys.all, "lots", stage, itemId] as const,
  pendingApprovals: () => [...wipKeys.all, "pending-approvals"] as const,
  activityEntries: (from: string, to: string, limit = 200, offset = 0) =>
    [...wipKeys.all, "activity-entries", from, to, limit, offset] as const,
};

export const procurementKeys = {
  all: ["procurement"] as const,
  orders: () => [...procurementKeys.all, "orders"] as const,
  orderDetails: (poId: string) =>
    [...procurementKeys.all, "order", poId] as const,
  materialOptions: () => [...procurementKeys.all, "materials"] as const,
};

export const usersKeys = {
  all: ["users"] as const,
  list: () => [...usersKeys.all, "list"] as const,
};

export const vendorsKeys = {
  all: ["vendors"] as const,
  list: () => [...vendorsKeys.all, "list"] as const,
};

export const reportsKeys = {
  all: ["reports"] as const,
  inventory: (days: number) => [...reportsKeys.all, "inventory", days] as const,
  purchase: (days: number) => [...reportsKeys.all, "purchase", days] as const,
  users: () => [...reportsKeys.all, "users"] as const,
  production: (date: string, lot: string) =>
    [...reportsKeys.all, "production", date, lot] as const,
};
