"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitDailyLog } from "@/lib/api/logs";

const INITIAL_STATE = {
  ok: false,
  message: "",
};

export function DailyLogForm() {
  const [state, setState] = useState(INITIAL_STATE);
  const submitMutation = useMutation({ mutationFn: submitDailyLog });

  const isPending = submitMutation.isPending;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      const result = await submitMutation.mutateAsync({
        source_batch_id: String(formData.get("source_batch_id") ?? "").trim(),
        output_item_name: String(formData.get("output_item_name") ?? "").trim(),
        output_item_specs: {
          thickness: Number(formData.get("output_specs_thickness") ?? 0),
          width: Number(formData.get("output_specs_width") ?? 0),
          coil_weight: Number(formData.get("output_specs_coil_weight") ?? 0),
        },
        input_qty: Number(formData.get("input_qty") ?? 0),
        finished_qty: Number(formData.get("finished_qty") ?? 0),
        scrap_qty: Number(formData.get("scrap_qty") ?? 0),
      });

      setState({
        ok: result.success,
        message: result.success
          ? "Daily log submitted successfully."
          : "Daily log request failed.",
      });

      if (result.success) {
        event.currentTarget.reset();
      }
    } catch (error) {
      setState({
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to submit daily log.",
      });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Add Daily Log</CardTitle>
          <CardDescription>
            Submit production output against a source batch.
          </CardDescription>
        </CardHeader>
      </Card>

      <form onSubmit={onSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Section 1: Source Material
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="source_batch_id">Source Batch ID</Label>
              <Input id="source_batch_id" name="source_batch_id" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="output_item_name">Output Product Name</Label>
              <Input id="output_item_name" name="output_item_name" required />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Section 2: Output Specs</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="output_specs_thickness">Specs: Thickness</Label>
              <Input
                id="output_specs_thickness"
                name="output_specs_thickness"
                type="number"
                step="0.0001"
                min="0"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="output_specs_width">Specs: Width</Label>
              <Input
                id="output_specs_width"
                name="output_specs_width"
                type="number"
                step="0.0001"
                min="0"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="output_specs_coil_weight">
                Specs: Coil Weight
              </Label>
              <Input
                id="output_specs_coil_weight"
                name="output_specs_coil_weight"
                type="number"
                step="0.0001"
                min="0"
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Section 3: Quantities</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="input_qty">Input Qty</Label>
              <Input
                id="input_qty"
                name="input_qty"
                type="number"
                step="0.0001"
                min="0"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="finished_qty">Finished Qty</Label>
              <Input
                id="finished_qty"
                name="finished_qty"
                type="number"
                step="0.0001"
                min="0"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scrap_qty">Scrap Qty</Label>
              <Input
                id="scrap_qty"
                name="scrap_qty"
                type="number"
                step="0.0001"
                min="0"
                defaultValue="0"
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Section 4: Submit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.message ? (
              <p
                className={
                  state.ok
                    ? "rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                    : "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                }
              >
                {state.message}
              </p>
            ) : null}

            <Button type="submit" disabled={isPending}>
              {isPending ? "Submitting..." : "Submit Daily Log"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
