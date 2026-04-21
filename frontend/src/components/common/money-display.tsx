import { cn } from "@/lib/utils";

type MoneyDisplayProps = {
  amount: number;
  className?: string;
  currency?: string;
  locale?: string;
};

export function formatMoney(
  amount: number,
  locale = "en-IN",
  currency = "INR",
): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}

export function MoneyDisplay({
  amount,
  className,
  currency = "INR",
  locale = "en-IN",
}: MoneyDisplayProps) {
  return (
    <span className={cn("tabular-nums", className)}>
      {formatMoney(amount, locale, currency)}
    </span>
  );
}
