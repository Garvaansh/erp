"use client";

import { useEffect, useId } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles, Info } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  polishingFormSchema,
  type PolishingFormValues,
} from "@/app/(dashboard)/production/wip/schemas";
import {
  getAllocatableStock,
  getFinishedGoodOptions,
  submitPolishingRun,
} from "@/lib/api/wip";
import { ApiClientError } from "@/lib/api/api-client";
import { inventoryKeys, productionKeys, wipKeys } from "@/lib/react-query/keys";

interface PolishingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PolishingDialog({ open, onOpenChange }: PolishingDialogProps) {
  const id = useId();
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PolishingFormValues>({
    resolver: zodResolver(polishingFormSchema),
    defaultValues: {
      output_item_id: "",
      scrap_qty: 0,
      shortlength_qty: 0,
      notes: "",
    },
  });

  const selectedItemId = useWatch({
    control,
    name: "output_item_id",
  });

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const { data: finishedGoods = [], isLoading: loadingItems } = useQuery({
    queryKey: ["finished-good-options"],
    queryFn: getFinishedGoodOptions,
    staleTime: 5 * 60 * 1000,
  });

  // Polishing consumes MOLDED batches indexed by the finished good's item_id
  const { data: allocatable, isLoading: loadingStock } = useQuery({
    queryKey: ["allocatable-molded", selectedItemId],
    queryFn: () => getAllocatableStock(selectedItemId, "MOLDED"),
    enabled: Boolean(selectedItemId),
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: submitPolishingRun,
    onSuccess: (result) => {
      toast.success("Polishing run logged", {
        description: `Bundle ${result.output_batch_code} produced — ${result.batches_consumed} molded batch(es) consumed.`,
      });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: wipKeys.runs() });
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.finishedGoodDetail(selectedItemId),
      });
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.finishedGoods(),
      });
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.finishedBundle(result.output_batch_code),
      });
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.finishedBundles(),
      });
      queryClient.invalidateQueries({
        queryKey: productionKeys.wipBatches(),
      });
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.snapshot(),
      });
    },
    onError: (err) => {
      const message =
        err instanceof ApiClientError
          ? err.message
          : "An unexpected error occurred";
      setError("input_qty", { message });
    },
  });

  function onSubmit(values: PolishingFormValues) {
    mutation.mutate({
      output_item_id: values.output_item_id,
      input_qty: values.input_qty,
      output_qty: values.output_qty,
      scrap_qty: values.scrap_qty,
      shortlength_qty: values.shortlength_qty,
      notes: values.notes ?? "",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-purple-500" />
            Log Polishing Run
          </DialogTitle>
          <DialogDescription>
            Select the finished good being polished. The system will
            automatically consume molded batches via FIFO.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-product`}>Finished Good</Label>
            <Controller
              control={control}
              name="output_item_id"
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={loadingItems}
                >
                  <SelectTrigger id={`${id}-product`}>
                    <SelectValue
                      placeholder={
                        loadingItems ? "Loading products…" : "Select product"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {finishedGoods.map((fg) => (
                      <SelectItem key={fg.id} value={fg.id}>
                        <span className="font-mono text-xs text-muted-foreground mr-2">
                          {fg.sku}
                        </span>
                        {fg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.output_item_id && (
              <p className="text-xs text-destructive">
                {errors.output_item_id.message}
              </p>
            )}
          </div>

          {selectedItemId && (
            <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm flex items-start gap-3">
              <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="space-y-0.5">
                {loadingStock ? (
                  <p className="text-muted-foreground">
                    Checking molded stock…
                  </p>
                ) : allocatable && allocatable.available_qty > 0 ? (
                  <>
                    <p className="font-medium">
                      Molded stock available:{" "}
                      <span className="tabular-nums">
                        {allocatable.available_qty.toFixed(2)} kg
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      {allocatable.batch_count} molded batch
                      {allocatable.batch_count !== 1 ? "es" : ""} · FIFO
                      allocation
                    </p>
                  </>
                ) : (
                  <p className="text-amber-600 font-medium">
                    No molded stock available. Log a molding run first.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-input`}>Molded Input (kg)</Label>
              <Input
                id={`${id}-input`}
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.0000"
                {...register("input_qty", { valueAsNumber: true })}
              />
              {errors.input_qty && (
                <p className="text-xs text-destructive">
                  {errors.input_qty.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${id}-output`}>Finished Output (kg)</Label>
              <Input
                id={`${id}-output`}
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.0000"
                {...register("output_qty", { valueAsNumber: true })}
              />
              {errors.output_qty && (
                <p className="text-xs text-destructive">
                  {errors.output_qty.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${id}-scrap`}>Scrap (kg)</Label>
              <Input
                id={`${id}-scrap`}
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.0000"
                {...register("scrap_qty", { valueAsNumber: true })}
              />
              {errors.scrap_qty && (
                <p className="text-xs text-destructive">
                  {errors.scrap_qty.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${id}-short`}>Shortlength (kg)</Label>
              <Input
                id={`${id}-short`}
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.0000"
                {...register("shortlength_qty", { valueAsNumber: true })}
              />
              {errors.shortlength_qty && (
                <p className="text-xs text-destructive">
                  {errors.shortlength_qty.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${id}-notes`}>Notes (optional)</Label>
            <Textarea
              id={`${id}-notes`}
              placeholder="Operator remarks…"
              className="resize-none"
              rows={2}
              {...register("notes")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              id="polishing-submit-btn"
              disabled={isSubmitting || mutation.isPending}
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {mutation.isPending ? "Logging…" : "Log Polishing Run"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
