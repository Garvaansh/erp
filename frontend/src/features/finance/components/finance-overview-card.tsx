import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function FinanceOverviewCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Finance Module</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Finance feature module scaffolded and ready for implementation.
        </p>
      </CardContent>
    </Card>
  );
}
