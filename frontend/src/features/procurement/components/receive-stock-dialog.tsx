"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReceiveStockSchema } from "@/features/procurement/schemas";
import {
  receivePurchaseOrderStock,
  voidProcurementReceipt,
} from "@/lib/api/procurement";
import { ApiClientError } from "@/lib/api/api-client";
import { procurementKeys } from "@/lib/react-query/keys";
import type { ReceiveStockInput } from "@/features/procurement/types";

type ReceiveStockDialogProps = {
  poId: string;
  poNumber: string;
  remainingQty: number;
};

export function ReceiveStockDialog({
  poId,
  poNumber,
  remainingQty,
}: ReceiveStockDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ReceiveStockInput>({
    resolver: zodResolver(ReceiveStockSchema),
    defaultValues: {
      po_id: poId,
      remaining_qty: remainingQty,
      actual_weight: remainingQty,
    },
    mode: "onBlur",
  });

  const receiveMutation = useMutation({
    mutationFn: receivePurchaseOrderStock,
    onError: (error) => {
      if (error instanceof ApiClientError && error.message.trim()) {
        setFormError(error.message);
        return;
      }

      if (error instanceof Error && error.message.trim()) {
        setFormError(error.message);
        return;
      }

      setFormError("Unable to receive this order.");
    },
  });

  const voidMutation = useMutation({
    mutationFn: voidProcurementReceipt,
  });

  useEffect(() => {
    form.reset({
      po_id: poId,
      remaining_qty: remainingQty,
      actual_weight: remainingQty,
    });
  }, [form, poId, remainingQty]);

  const onSubmit = (values: ReceiveStockInput) => {
    setFormError(null);
    receiveMutation.mutate(values, {
      onSuccess: async (result) => {
        setOpen(false);

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: procurementKeys.orders() }),
          queryClient.invalidateQueries({
            queryKey: procurementKeys.orderDetails(poId),
          }),
        ]);

        const generatedBatchCode = result.batch_code?.trim() || "LOT generated";
        const generatedTransactionID = result.transaction_id?.trim() || "";

        toast.success(`PO Received. ${generatedBatchCode}.`, {
          duration: 5000,
          action: generatedTransactionID
            ? {
                label: "UNDO",
                onClick: async () => {
                  try {
                    await voidMutation.mutateAsync({
                      po_id: poId,
                      transaction_id: generatedTransactionID,
                    });

                    await Promise.all([
                      queryClient.invalidateQueries({
                        queryKey: procurementKeys.orders(),
                      }),
                      queryClient.invalidateQueries({
                        queryKey: procurementKeys.orderDetails(poId),
                      }),
                    ]);

                    toast.success("Receipt rolled back.");
                  } catch (error) {
                    if (error instanceof Error && error.message.trim()) {
                      toast.error(error.message);
                    } else {
                      toast.error("Undo failed.");
                    }
                  }
                },
              }
            : undefined,
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="default" />}>
        Receive Goods
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive Purchase Order</DialogTitle>
          <DialogDescription>
            Receiving {poNumber}. Enter the physical receipt weight for this
            truck.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...form.register("po_id")} />
          <input
            type="hidden"
            {...form.register("remaining_qty", { valueAsNumber: true })}
          />

          <div className="space-y-2">
            <Label htmlFor="actual_weight">Actual Weight (kg)</Label>
            <Input
              id="actual_weight"
              type="number"
              step="0.0001"
              min="0"
              {...form.register("actual_weight", { valueAsNumber: true })}
            />
            <p className="text-xs text-slate-500">
              Remaining: {remainingQty.toFixed(2)} kg
            </p>
            {form.formState.errors.actual_weight ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.actual_weight.message}
              </p>
            ) : null}
          </div>

          {formError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="submit"
              disabled={receiveMutation.isPending || voidMutation.isPending}
            >
              {receiveMutation.isPending ? "Receiving..." : "Confirm Receipt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
