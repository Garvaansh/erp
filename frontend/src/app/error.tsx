"use client";

import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10">
        <AlertTriangle className="size-8 text-red-400" />
      </div>

      <h2 className="mb-2 text-lg font-bold text-(--erp-text-primary)">
        Something went wrong
      </h2>
      <p className="mb-6 text-sm text-(--erp-text-muted)">
        {error.message ||
          "An unexpected error occurred while loading this page."}
      </p>

      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-(--erp-accent) px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-(--erp-accent-bright) transition-colors"
      >
        Retry
      </button>
    </div>
  );
}
