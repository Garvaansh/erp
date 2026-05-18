import { apiClient } from "@/lib/api/api-client";
import { InvoiceResponse } from "../types";

export async function generateInvoice(orderId: string): Promise<InvoiceResponse> {
  return apiClient<InvoiceResponse>(`/orders/${orderId}/invoice`, { method: "POST" });
}

export async function getInvoice(invoiceId: string): Promise<InvoiceResponse> {
  return apiClient<InvoiceResponse>(`/invoices/${invoiceId}`, { method: "GET" });
}

export async function getInvoiceByOrder(orderId: string): Promise<InvoiceResponse> {
  return apiClient<InvoiceResponse>(`/orders/${orderId}/invoice`, { method: "GET" });
}
