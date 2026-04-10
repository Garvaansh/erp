"use client";

import { useEffect, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
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
import {
  receiveStockAction,
  voidReceiptAction,
} from "@/features/procurement/actions";
import { ReceiveStockSchema } from "@/features/procurement/schemas";
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, startTransition] = useTransition();
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

  useEffect(() => {
    form.reset({
      po_id: poId,
      remaining_qty: remainingQty,
      actual_weight: remainingQty,
    });
  }, [form, poId, remainingQty]);

  const onSubmit = (values: ReceiveStockInput) => {
    setFormError(null);

    startTransition(async () => {
      const result = await receiveStockAction(values);

      if (!result.ok) {
        setFormError(result.error ?? "Unable to receive this order.");
        return;
      }

      setOpen(false);
      router.refresh();

      const generatedBatchCode =
        result.data?.batch_code?.trim() || "LOT generated";
      const generatedTransactionID = result.data?.transaction_id?.trim() || "";

      toast.success(`PO Received. ${generatedBatchCode}.`, {
        duration: 5000,
        action: generatedTransactionID
          ? {
              label: "UNDO",
              onClick: async () => {
                const undoResult = await voidReceiptAction(
                  generatedTransactionID,
                  poId,
                );
                if (!undoResult.ok) {
                  toast.error(undoResult.error ?? "Undo failed.");
                  return;
                }

                toast.success("Receipt rolled back.");
                router.refresh();
              },
            }
          : undefined,
      });
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Receiving..." : "Confirm Receipt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
