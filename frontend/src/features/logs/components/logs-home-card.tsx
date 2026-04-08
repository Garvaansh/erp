import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LogsHomeCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Production Logs</CardTitle>
        <CardDescription>
          Record and review daily production activity.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/logs/add"
            className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Add Daily Log
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm font-medium transition hover:bg-muted"
          >
            Back to Dashboard
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
