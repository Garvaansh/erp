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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatQuantity } from "@/features/orders/utils/format";
import { useDispatchOrder } from "@/features/orders/hooks/use-order-mutations";
import { dispatchOrderSchema, type DispatchOrderValues } from "@/features/orders/schemas/order-schema";
import { getOrderErrorMessage } from "@/features/orders/utils/errors";
import type { OrderDetail } from "@/features/orders/types";

type DispatchOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderDetail;
};

export function DispatchOrderDialog({
  open,
  onOpenChange,
  order,
}: DispatchOrderDialogProps) {
  const dispatchMutation = useDispatchOrder();

  const form = useForm<DispatchOrderValues>({
    resolver: zodResolver(dispatchOrderSchema),
    defaultValues: {
      notes: "",
      lines: order.lines.map((line) => ({
        sales_order_line_id: line.id,
        dispatch_qty: Math.max(line.ordered_qty - line.dispatched_qty, 0),
      })),
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        notes: "",
        lines: order.lines.map((line) => ({
          sales_order_line_id: line.id,
          dispatch_qty: Math.max(line.ordered_qty - line.dispatched_qty, 0),
        })),
      });
    }
  }, [form, open, order.lines]);

  async function onSubmit(values: DispatchOrderValues) {
    try {
      await dispatchMutation.mutateAsync({
        orderId: order.id,
        payload: {
          notes: values.notes,
          lines: values.lines.filter((line) => line.dispatch_qty > 0),
        },
      });
      toast.success("Dispatch recorded.");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        getOrderErrorMessage(error, "Unable to dispatch this order right now."),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dispatch Order</DialogTitle>
          <DialogDescription>
            Confirm dispatch quantities for this document. Inventory will be
            deducted only for the quantities entered here.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="rounded-xl border bg-muted/20">
            <div className="grid grid-cols-[1.2fr_0.7fr_0.7fr] gap-3 border-b px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <div>Line</div>
              <div>Remaining</div>
              <div>Dispatch Now</div>
            </div>
            <div className="space-y-3 px-4 py-4">
              {order.lines.map((line, index) => {
                const remainingQty = Math.max(
                  line.ordered_qty - line.dispatched_qty,
                  0,
                );
                return (
                  <div
                    key={line.id}
                    className="grid grid-cols-[1.2fr_0.7fr_0.7fr] gap-3"
                  >
                    <div>
                      <div className="font-medium text-foreground">
                        {line.item_sku || "SKU"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {line.item_name}
                      </div>
                    </div>
                    <div className="pt-2 text-sm">{formatQuantity(remainingQty)}</div>
                    <div>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        {...form.register(`lines.${index}.dispatch_qty`, {
                          valueAsNumber: true,
                        })}
                      />
                      {form.formState.errors.lines?.[index]?.dispatch_qty ? (
                        <p className="mt-1 text-xs text-destructive">
                          {form.formState.errors.lines[index]?.dispatch_qty?.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-sm font-medium text-foreground">Notes</div>
            <Textarea
              rows={3}
              placeholder="Dispatch notes"
              {...form.register("notes")}
            />
          </div>

          {form.formState.errors.lines?.message ? (
            <p className="text-sm text-destructive">
              {String(form.formState.errors.lines.message)}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={dispatchMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={dispatchMutation.isPending}>
              {dispatchMutation.isPending ? "Dispatching..." : "Confirm Dispatch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
