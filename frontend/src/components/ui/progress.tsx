"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ProgressProps = React.ComponentProps<"progress"> & {
  value?: number;
};

export function Progress({ value = 0, className, ...props }: ProgressProps) {
  const boundedValue = Math.max(0, Math.min(100, value));

  return (
    <progress
      data-slot="progress"
      value={boundedValue}
      max={100}
      className={cn(
        "h-2.5 w-full overflow-hidden rounded-full bg-muted [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-slate-700 [&::-moz-progress-bar]:bg-slate-700",
        className,
      )}
      {...props}
    />
  );
}
