"use client";

import { useEffect, useId } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, FlaskConical, Info } from "lucide-react";

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
  moldingFormSchema,
  type MoldingFormValues,
} from "@/app/(dashboard)/production/wip/schemas";
import {
  getAllocatableStock,
  getFinishedGoodOptions,
  submitMoldingRun,
} from "@/lib/api/wip";
import { inventoryKeys, productionKeys, wipKeys } from "@/lib/react-query/keys";
import { ApiClientError } from "@/lib/api/api-client";
import type { WIPFinishedGoodOption } from "@/app/(dashboard)/production/wip/types";

interface MoldingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MoldingDialog({ open, onOpenChange }: MoldingDialogProps) {
  const id = useId();
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MoldingFormValues>({
    resolver: zodResolver(moldingFormSchema),
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

  // ── Finished goods dropdown ──────────────────────────────────────────────
  const { data: finishedGoods = [], isLoading: loadingItems } = useQuery({
    queryKey: ["finished-good-options"],
    queryFn: getFinishedGoodOptions,
    staleTime: 5 * 60 * 1000,
  });

  const selectedItem: WIPFinishedGoodOption | undefined = finishedGoods.find(
    (fg) => fg.id === selectedItemId,
  );

  // ── Allocatable raw stock context card ───────────────────────────────────
  const rawItemId = selectedItem?.linked_raw_material_id;
  const { data: allocatable, isLoading: loadingStock } = useQuery({
    queryKey: ["allocatable-raw", rawItemId],
    queryFn: () => getAllocatableStock(rawItemId!, "RAW"),
    enabled: Boolean(rawItemId),
    staleTime: 30_000,
  });

  // ── Mutation ─────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: submitMoldingRun,
    onSuccess: (result) => {
      toast.success("Molding run logged", {
        description: `Batch ${result.output_batch_code} created — ${result.batches_consumed} source batch(es) consumed.`,
      });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: wipKeys.runs() });
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.finishedGoods(),
      });
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.finishedGoodDetail(selectedItemId),
      });
      if (rawItemId) {
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.rawMaterialSummary(rawItemId),
        });
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.rawMaterialBatches(rawItemId),
        });
      }
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.rawBatches(),
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

  function onSubmit(values: MoldingFormValues) {
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
            <FlaskConical className="h-4 w-4 text-blue-500" />
            Log Molding Run
          </DialogTitle>
          <DialogDescription>
            Select the finished good being produced. The system will
            automatically allocate raw material via FIFO.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Product selector */}
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

          {/* Inventory context card */}
          {selectedItemId && (
            <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm flex items-start gap-3">
              <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="space-y-0.5">
                {!selectedItem?.linked_raw_material_id ? (
                  <p className="text-destructive font-medium">
                    Recipe not configured — this item has no linked raw
                    material. Contact your administrator.
                  </p>
                ) : loadingStock ? (
                  <p className="text-muted-foreground">
                    Checking raw material stock…
                  </p>
                ) : allocatable ? (
                  <>
                    <p className="font-medium">
                      Raw stock available:{" "}
                      <span className="tabular-nums">
                        {allocatable.available_qty.toFixed(2)} kg
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      {allocatable.batch_count} active batch
                      {allocatable.batch_count !== 1 ? "es" : ""} · FIFO
                      allocation
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    No active raw material stock found.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Qty inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-input`}>Input (kg)</Label>
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
              <Label htmlFor={`${id}-output`}>Molded Output (kg)</Label>
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

          {/* Notes */}
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
              id="molding-submit-btn"
              disabled={isSubmitting || mutation.isPending}
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {mutation.isPending ? "Logging…" : "Log Molding Run"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
