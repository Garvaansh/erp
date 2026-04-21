import { useQuery } from "@tanstack/react-query";
import { getPayables } from "@/lib/api/finance";
import { financeKeys } from "@/lib/react-query/keys";
import type { PayablesResponse } from "@/types/finance";

export function usePayables() {
  const query = useQuery<PayablesResponse, Error>({
    queryKey: financeKeys.payables(),
    queryFn: getPayables,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    data: query.data ?? [],
  };
}
