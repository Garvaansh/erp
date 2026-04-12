import { apiClient } from "@/lib/api/api-client";

export type ProductionReportParams = {
  date?: string;
  lot?: string;
};

export type ProductionReportResponse = {
  rows?: unknown[];
};

export async function getProductionReport(
  params: ProductionReportParams,
): Promise<ProductionReportResponse> {
  const query = new URLSearchParams();

  if (params.date?.trim()) {
    query.set("date", params.date.trim());
  }

  if (params.lot?.trim()) {
    query.set("lot", params.lot.trim());
  }

  const suffix = query.toString();
  const path = suffix ? `/reports/production?${suffix}` : "/reports/production";

  return apiClient<ProductionReportResponse>(path, {
    method: "GET",
  });
}
