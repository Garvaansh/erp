import { useMutation, useQueryClient } from "@tanstack/react-query";
import { logPayment } from "@/lib/api/finance";
import { financeKeys } from "@/lib/react-query/keys";
import type { LogPaymentPayload } from "@/types/finance";

export function useLogPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LogPaymentPayload) => logPayment(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.payables() });
    },
  });
}
