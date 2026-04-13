import { apiClient } from "@/lib/api/api-client";
import type { InventoryReport, PurchaseReport, UsersReport } from "./types";

export async function getInventoryReport(days = 30): Promise<InventoryReport> {
  return apiClient<InventoryReport>(`/reports/inventory?days=${days}`, { method: "GET" });
}

export async function getPurchaseReport(days = 30): Promise<PurchaseReport> {
  return apiClient<PurchaseReport>(`/reports/purchase?days=${days}`, { method: "GET" });
}

export async function getUsersReport(): Promise<UsersReport> {
  return apiClient<UsersReport>("/reports/users", { method: "GET" });
}
