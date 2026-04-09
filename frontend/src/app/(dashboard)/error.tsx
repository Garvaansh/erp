"use client";

import { useEffect } from "react";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error("Dashboard segment error:", error);
  }, [error]);

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
      <h2 className="font-semibold text-destructive">Failed to load data</h2>
      <p className="mt-1 text-sm text-destructive/90">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-3 rounded bg-destructive px-3 py-1 text-sm text-white"
      >
        Retry
      </button>
    </div>
  );
}
