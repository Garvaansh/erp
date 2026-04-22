import { useQuery } from "@tanstack/react-query";
import { getVendorProfile, getVendors } from "@/features/vendors/api";
import { vendorsKeys } from "@/lib/react-query/keys";

export type VendorFilter = "active" | "archived" | "all";

export function vendorsQueryOptions(filter: VendorFilter, search: string) {
  return {
    queryKey: vendorsKeys.list(filter, search),
    queryFn: () => getVendors(filter, search),
    staleTime: 30_000,
  };
}

export function vendorProfileQueryOptions(id: string) {
  return {
    queryKey: vendorsKeys.profile(id),
    queryFn: () => getVendorProfile(id),
    staleTime: 30_000,
  };
}

export function useVendors(filter: VendorFilter, search: string) {
  return useQuery(vendorsQueryOptions(filter, search));
}

export function useVendorProfile(id: string) {
  return useQuery({
    ...vendorProfileQueryOptions(id),
    enabled: Boolean(id.trim()),
    refetchOnWindowFocus: false,
  });
}
