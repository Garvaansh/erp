"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cancelOrderSchema, type CancelOrderValues } from "@/features/orders/schemas/order-schema";
import { useCancelOrder } from "@/features/orders/hooks/use-order-mutations";
import { getOrderErrorMessage } from "@/features/orders/utils/errors";

type CancelOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
};

export function CancelOrderDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
}: CancelOrderDialogProps) {
  const cancelMutation = useCancelOrder();
  const form = useForm<CancelOrderValues>({
    resolver: zodResolver(cancelOrderSchema),
    defaultValues: {
      reason: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ reason: "" });
    }
  }, [form, open]);

  async function onSubmit(values: CancelOrderValues) {
    try {
      await cancelMutation.mutateAsync({
        orderId,
        reason: values.reason,
      });
      toast.success("Order cancelled.");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        getOrderErrorMessage(error, "Unable to cancel this order right now."),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Order</DialogTitle>
          <DialogDescription>
            Release the remaining reservation for {orderNumber}. Dispatched stock
            will not be restored.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Textarea
            rows={4}
            placeholder="Why is this order being cancelled?"
            {...form.register("reason")}
          />
          {form.formState.errors.reason ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.reason.message}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={cancelMutation.isPending}
            >
              Back
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Confirm Cancel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
