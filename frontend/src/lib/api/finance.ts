import { apiClient } from "@/lib/api/api-client";
import type {
  LogPaymentPayload,
  LogPaymentResponse,
  PayablePO,
  PayablePOStatus,
  PayablesResponse,
  PayableVendor,
} from "@/types/finance";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return "";
}

function readNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function readNullableDate(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return null;
}

function readPOStatus(value: unknown): PayablePOStatus {
  if (value === "UNPAID" || value === "PARTIAL" || value === "PAID") {
    return value;
  }

  return "UNPAID";
}

function parsePayablePO(value: unknown): PayablePO | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    po_id: readString(value.po_id),
    po_number: readString(value.po_number),
    status: readPOStatus(value.status),
    total_value: readNumber(value.total_value),
    paid: readNumber(value.paid),
    due: readNumber(value.due),
    last_payment_date: readNullableDate(value.last_payment_date),
  };
}

function parsePayableVendor(value: unknown): PayableVendor | null {
  if (!isRecord(value)) {
    return null;
  }

  const unpaidPOs = Array.isArray(value.unpaid_pos)
    ? value.unpaid_pos
        .map((row) => parsePayablePO(row))
        .filter((row): row is PayablePO => row !== null)
    : [];

  return {
    vendor_id: readString(value.vendor_id),
    vendor_name: readString(value.vendor_name),
    vendor_code: readString(value.vendor_code),
    total_purchased: readNumber(value.total_purchased),
    total_paid: readNumber(value.total_paid),
    total_due: readNumber(value.total_due),
    unpaid_pos: unpaidPOs,
  };
}

function parsePayables(payload: unknown): PayablesResponse {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((row) => parsePayableVendor(row))
    .filter((row): row is PayableVendor => row !== null);
}

export async function getPayables(): Promise<PayablesResponse> {
  const data = await apiClient<unknown>("/finance/payables", {
    method: "GET",
  });

  return parsePayables(data);
}

export async function logPayment(
  payload: LogPaymentPayload,
): Promise<LogPaymentResponse> {
  return apiClient<LogPaymentResponse>("/payments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
