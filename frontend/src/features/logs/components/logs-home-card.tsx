"use client";

import Link from "next/link";
import { Plus, ClipboardList, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogsHomeCard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Production Logs
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Record and review daily production entries.
          </p>
        </div>
        <Link href="/logs/add">
          <Button size="sm">
            <Plus className="size-3.5" />
            New Entry
          </Button>
        </Link>
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-5">
        <div className="flex items-start gap-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-500/15 shrink-0">
            <ClipboardList className="size-[18px] text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">
              Daily Production Journal
            </p>
            <p className="text-[13px] text-muted-foreground max-w-lg leading-relaxed">
              Each entry records input material, finished output, scrap quantities,
              and worker details for a production batch.
            </p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/logs/add"
          className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-all group"
        >
          <div>
            <p className="text-[13px] font-medium text-foreground mb-0.5">
              Add Production Entry
            </p>
            <p className="text-[11px] text-muted-foreground">
              Record a new batch with I/O details.
            </p>
          </div>
          <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
        </Link>
        <Link
          href="/dashboard"
          className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-all group"
        >
          <div>
            <p className="text-[13px] font-medium text-foreground mb-0.5">
              View Activity Feed
            </p>
            <p className="text-[11px] text-muted-foreground">
              Recent entries on the dashboard.
            </p>
          </div>
          <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
        </Link>
      </div>
    </div>
  );
}
