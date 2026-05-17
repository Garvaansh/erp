import type { PaymentStatus } from "@/features/orders/types";

const quantityFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatQuantity(value: number): string {
  return `${quantityFormatter.format(Number.isFinite(value) ? value : 0)} kg`;
}

export function formatCurrency(value: number): string {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatDate(value?: string): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value?: string): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getPaymentStatusLabel(status: PaymentStatus = "UNPAID"): string {
  switch (status) {
    case "PAID":
      return "Paid";
    case "PARTIALLY_PAID":
      return "Partially Paid";
    default:
      return "Unpaid";
  }
}
