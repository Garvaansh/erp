import { apiClient } from "@/lib/api/api-client";
import type { Vendor, CreateVendorPayload, UpdateVendorPayload } from "./types";

export async function getVendors(): Promise<Vendor[]> {
  const data = await apiClient<Vendor[]>("/vendors", { method: "GET" });
  return Array.isArray(data) ? data : [];
}

export async function createVendor(payload: CreateVendorPayload): Promise<unknown> {
  return apiClient("/vendors", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateVendor(id: string, payload: UpdateVendorPayload): Promise<unknown> {
  return apiClient(`/vendors/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}
