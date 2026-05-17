"use client";

import { formatDateTime } from "@/features/orders/utils/format";
import type { OrderDetail } from "@/features/orders/types";

type TimelineEvent = {
  label: string;
  timestamp?: string;
  tone?: "neutral" | "success" | "warning" | "destructive";
};

function deriveTimeline(order: OrderDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      label: "Order created",
      timestamp: order.created_at,
      tone: "neutral",
    },
  ];

  if (order.reserved_at) {
    events.push({
      label: "Inventory reserved",
      timestamp: order.reserved_at,
      tone: "warning",
    });
  }

  if (order.status === "PARTIALLY_DISPATCHED") {
    events.push({
      label: "Partial dispatch in progress",
      timestamp: order.updated_at,
      tone: "neutral",
    });
  }

  if (order.dispatched_at) {
    events.push({
      label: "Order fully dispatched",
      timestamp: order.dispatched_at,
      tone: "success",
    });
  }

  if (order.cancelled_at) {
    events.push({
      label: "Order cancelled",
      timestamp: order.cancelled_at,
      tone: "destructive",
    });
  }

  return events;
}

function dotClassName(tone: TimelineEvent["tone"]) {
  switch (tone) {
    case "success":
      return "bg-emerald-500";
    case "warning":
      return "bg-amber-500";
    case "destructive":
      return "bg-rose-500";
    default:
      return "bg-slate-400";
  }
}

export function OrderTimeline({ order }: { order: OrderDetail }) {
  const events = deriveTimeline(order);

  return (
    <div className="rounded-[24px] border bg-background px-4 py-4 md:px-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">
          Dispatch Timeline
        </h3>
        <p className="text-sm text-muted-foreground">
          High-level operational milestones for this document.
        </p>
      </div>

      <div className="space-y-4">
        {events.map((event) => (
          <div key={`${event.label}-${event.timestamp ?? "na"}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`mt-1 size-2.5 rounded-full ${dotClassName(event.tone)}`} />
              <span className="mt-1 h-full w-px bg-border" />
            </div>
            <div className="pb-2">
              <div className="font-medium text-foreground">{event.label}</div>
              <div className="text-sm text-muted-foreground">
                {formatDateTime(event.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
