import { apiClient } from "@/lib/api/api-client";
import type {
  Vendor,
  CreateVendorPayload,
  UpdateVendorPayload,
  VendorProfile,
} from "./types";

export async function getVendors(
  filter: "active" | "archived" | "all" = "active",
  search = "",
): Promise<Vendor[]> {
  const params = new URLSearchParams();
  params.set("filter", filter);
  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    params.set("search", trimmedSearch);
  }

  const queryString = params.toString();
  const data = await apiClient<Vendor[]>(
    `/vendors${queryString ? `?${queryString}` : ""}`,
    { method: "GET" },
  );
  return Array.isArray(data) ? data : [];
}

export async function getVendorProfile(id: string): Promise<VendorProfile> {
  return apiClient<VendorProfile>(`/vendors/${encodeURIComponent(id)}/profile`, {
    method: "GET",
  });
}

export async function createVendor(
  payload: CreateVendorPayload,
): Promise<Vendor> {
  return apiClient("/vendors", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateVendor(
  id: string,
  payload: UpdateVendorPayload,
): Promise<Vendor> {
  return apiClient(`/vendors/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
