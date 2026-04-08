import { apiClient } from "@/lib/api-client";
import type { DashboardSummary } from "@/features/dashboard/types";

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const data = await apiClient<DashboardSummary>("/dashboard", {
    method: "GET",
  });

  return data;
}
