"use client";

import { useActionState } from "react";
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
import { submitDailyLogAction } from "@/features/logs/actions";

const INITIAL_STATE = {
  ok: false,
  message: "",
};

export function DailyLogForm() {
  const [state, formAction, isPending] = useActionState(
    submitDailyLogAction,
    INITIAL_STATE,
  );

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

      <form action={formAction} className="space-y-4">
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
              <Label htmlFor="output_specs_grade">Specs: Grade</Label>
              <Input
                id="output_specs_grade"
                name="output_specs_grade"
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
              <Label htmlFor="output_specs_coil_weight">Specs: Coil Weight</Label>
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
