import { redirect } from "next/navigation";
import { getDashboardSummary } from "@/features/dashboard/api";
import { DashboardSummaryCard } from "@/features/dashboard/components/dashboard-summary-card";
import { ApiClientError } from "@/lib/api-client";

export const dynamic = "force-dynamic";

async function loadDashboardSummaryOrRedirect() {
  try {
    return await getDashboardSummary();
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 401) {
      redirect("/login?next=/dashboard");
    }

    throw error;
  }
}

export default async function DashboardPage() {
  const summary = await loadDashboardSummaryOrRedirect();
  return <DashboardSummaryCard summary={summary} />;
}
