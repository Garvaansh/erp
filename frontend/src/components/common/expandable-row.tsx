import type { ReactNode } from "react";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type ExpandableRowProps = {
  value: string;
  title: ReactNode;
  subtitle?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  triggerLabel?: string;
};

export function ExpandableRow({
  value,
  title,
  subtitle,
  summary,
  children,
  triggerLabel,
}: ExpandableRowProps) {
  return (
    <AccordionItem
      value={value}
      className="rounded-xl border border-border bg-card px-4"
    >
      <AccordionTrigger
        className="py-4 hover:no-underline"
        aria-label={triggerLabel}
      >
        <div className="flex w-full flex-col gap-4 pr-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="font-medium text-foreground">{title}</div>
            {subtitle ? (
              <div className="text-sm text-muted-foreground">{subtitle}</div>
            ) : null}
          </div>
          {summary ? <div className="shrink-0">{summary}</div> : null}
        </div>
      </AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  );
}
