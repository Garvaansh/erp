import { useQuery } from "@tanstack/react-query";
import { getLedger } from "@/lib/api/finance";
import { financeKeys } from "@/lib/react-query/keys";
import type { LedgerEntry, LedgerFilter } from "@/types/finance";

export function useLedger(filter?: LedgerFilter) {
  const query = useQuery<LedgerEntry[], Error>({
    queryKey: financeKeys.ledger(filter?.from_date, filter?.to_date),
    queryFn: () => getLedger(filter),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    data: query.data ?? [],
  };
}
