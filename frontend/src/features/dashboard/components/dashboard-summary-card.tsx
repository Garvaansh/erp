import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardSummary } from "@/features/dashboard/types";

type DashboardSummaryCardProps = {
  summary: DashboardSummary;
};

export function DashboardSummaryCard({ summary }: DashboardSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dashboard</CardTitle>
        <CardDescription>Aggregated production snapshot.</CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">
          {JSON.stringify(summary, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
