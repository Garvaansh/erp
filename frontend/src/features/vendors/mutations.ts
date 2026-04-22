import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { createVendor, updateVendor } from "@/features/vendors/api";
import type { CreateVendorPayload, UpdateVendorPayload } from "./types";
import { vendorsKeys } from "@/lib/react-query/keys";

type UpdateVendorVariables = {
  id: string;
  payload: UpdateVendorPayload;
};

async function invalidateVendorQueries(queryClient: QueryClient, id?: string) {
  await queryClient.invalidateQueries({ queryKey: vendorsKeys.all });
  if (id) {
    await queryClient.invalidateQueries({ queryKey: vendorsKeys.profile(id) });
  }
}

export function createVendorMutationOptions(queryClient: QueryClient) {
  return {
    mutationFn: (payload: CreateVendorPayload) => createVendor(payload),
    onSuccess: async () => {
      await invalidateVendorQueries(queryClient);
    },
  };
}

export function updateVendorMutationOptions(queryClient: QueryClient) {
  return {
    mutationFn: ({ id, payload }: UpdateVendorVariables) =>
      updateVendor(id, payload),
    onSuccess: async (_data: unknown, variables: UpdateVendorVariables) => {
      await invalidateVendorQueries(queryClient, variables.id);
    },
  };
}

export function useCreateVendor() {
  const queryClient = useQueryClient();
  return useMutation(createVendorMutationOptions(queryClient));
}

export function useUpdateVendor() {
  const queryClient = useQueryClient();
  return useMutation(updateVendorMutationOptions(queryClient));
}
