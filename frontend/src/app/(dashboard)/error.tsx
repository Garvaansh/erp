"use client";

import { AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 mb-5">
        <AlertTriangle className="size-8 text-red-400" />
      </div>
      <h2 className="text-lg font-bold text-[var(--erp-text-primary)] mb-2">
        System Error Detected
      </h2>
      <p className="text-sm text-[var(--erp-text-muted)] text-center max-w-md mb-6">
        {error.message || "An unexpected error occurred in the ERP module."}
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-[var(--erp-accent)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] hover:bg-[var(--erp-accent-bright)] transition-colors"
        >
          Retry Operation
        </button>
        <a
          href="/dashboard"
          className="rounded-lg border border-[var(--erp-border-default)] px-4 py-2 text-sm font-medium text-[var(--erp-text-secondary)] hover:border-[var(--erp-accent)] transition-colors"
        >
          Return to Command Center
        </a>
      </div>
    </div>
  );
}
