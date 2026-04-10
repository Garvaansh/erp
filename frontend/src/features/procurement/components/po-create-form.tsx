"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPOAction } from "@/features/procurement/actions";
import { CreatePOSchema } from "@/features/procurement/schemas";
import type {
  CreatePOInput,
  ProcurementMaterialOption,
} from "@/features/procurement/types";

type POCreateFormProps = {
  materials: ProcurementMaterialOption[];
};

export function POCreateForm({ materials }: POCreateFormProps) {
  const router = useRouter();
  const [isSubmitting, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<CreatePOInput>({
    resolver: zodResolver(CreatePOSchema),
    defaultValues: {
      item_id: "",
      supplier_name: "",
      ordered_qty: 0,
      unit_price: 0,
    },
    mode: "onBlur",
  });

  const onSubmit = (values: CreatePOInput) => {
    setFormError(null);

    startTransition(async () => {
      const result = await createPOAction(values);
      if (!result.ok) {
        setFormError(result.error ?? "Unable to create purchase order.");
        return;
      }

      router.push("/procurement");
      router.refresh();
    });
  };

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader>
        <CardTitle>Create Purchase Order</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item_id">Material</Label>
            <Controller
              control={form.control}
              name="item_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="item_id" className="w-full">
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((material) => (
                      <SelectItem
                        key={material.item_id}
                        value={material.item_id}
                      >
                        {material.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.item_id ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.item_id.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier_name">Supplier Name</Label>
            <Input id="supplier_name" {...form.register("supplier_name")} />
            {form.formState.errors.supplier_name ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.supplier_name.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ordered_qty">Quantity (kg)</Label>
              <Input
                id="ordered_qty"
                type="number"
                step="0.0001"
                min="0"
                {...form.register("ordered_qty", { valueAsNumber: true })}
              />
              {form.formState.errors.ordered_qty ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.ordered_qty.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit_price">Unit Price (INR/kg)</Label>
              <Input
                id="unit_price"
                type="number"
                step="0.0001"
                min="0"
                {...form.register("unit_price", { valueAsNumber: true })}
              />
              {form.formState.errors.unit_price ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.unit_price.message}
                </p>
              ) : null}
            </div>
          </div>

          {formError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Purchase Order"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
