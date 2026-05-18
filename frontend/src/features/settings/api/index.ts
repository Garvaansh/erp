import { apiClient } from "@/lib/api/api-client";
import { BusinessSettingsFormValues, InvoiceSettingsFormValues, WhatsappSettingsFormValues } from "../types";

export async function getBusinessSettings(): Promise<BusinessSettingsFormValues> {
  return apiClient<BusinessSettingsFormValues>("/settings/business", { method: "GET" });
}

export async function updateBusinessSettings(data: BusinessSettingsFormValues): Promise<void> {
  await apiClient("/settings/business", { method: "PUT", body: JSON.stringify(data) });
}

export async function getInvoiceSettings(): Promise<InvoiceSettingsFormValues> {
  return apiClient<InvoiceSettingsFormValues>("/settings/invoice", { method: "GET" });
}

export async function updateInvoiceSettings(data: InvoiceSettingsFormValues): Promise<void> {
  await apiClient("/settings/invoice", { method: "PUT", body: JSON.stringify(data) });
}

export async function getWhatsappSettings(): Promise<WhatsappSettingsFormValues> {
  return apiClient<WhatsappSettingsFormValues>("/settings/whatsapp", { method: "GET" });
}

export async function updateWhatsappSettings(data: WhatsappSettingsFormValues): Promise<void> {
  await apiClient("/settings/whatsapp", { method: "PUT", body: JSON.stringify(data) });
}
