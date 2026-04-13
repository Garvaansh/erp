import type { ReportFilters, ReportResponse, ReportType } from "./types";
import { getMockInventoryReport } from "@/mocks/reports/inventory.mock";
import { getMockPurchaseReport } from "@/mocks/reports/purchase.mock";
import { getMockSalesReport } from "@/mocks/reports/sales.mock";

export const getInventoryReport = async (
  filters: ReportFilters,
): Promise<ReportResponse> => {
  return getMockInventoryReport(filters);
};

export const getPurchaseReport = async (
  filters: ReportFilters,
): Promise<ReportResponse> => {
  return getMockPurchaseReport(filters);
};

export const getSalesReport = async (
  filters: ReportFilters,
): Promise<ReportResponse> => {
  return getMockSalesReport(filters);
};

const reportFetchers: Record<
  ReportType,
  (filters: ReportFilters) => Promise<ReportResponse>
> = {
  inventory: getInventoryReport,
  purchase: getPurchaseReport,
  sales: getSalesReport,
};

export const getReportByType = async (
  type: ReportType,
  filters: ReportFilters,
): Promise<ReportResponse> => {
  return reportFetchers[type](filters);
};
