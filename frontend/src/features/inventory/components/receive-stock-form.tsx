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
import { receiveStockFormAction } from "@/features/inventory/actions";

const INITIAL_STATE = {
  ok: false,
  message: "",
};

export function ReceiveStockForm() {
  const [state, formAction, isPending] = useActionState(
    receiveStockFormAction,
    INITIAL_STATE,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receive Stock</CardTitle>
        <CardDescription>
          Mutation flow: component to feature action to feature API to BFF.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="item_id">Item ID</Label>
            <Input id="item_id" name="item_id" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch_code">Batch Code</Label>
            <Input id="batch_code" name="batch_code" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              step="0.0001"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit_cost">Unit Cost</Label>
            <Input
              id="unit_cost"
              name="unit_cost"
              type="number"
              step="0.01"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reference_type">Reference Type</Label>
            <Input
              id="reference_type"
              name="reference_type"
              defaultValue="PURCHASE_RECEIPT"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reference_id">Reference ID</Label>
            <Input id="reference_id" name="reference_id" required />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" />
          </div>

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

          <div className="md:col-span-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Receiving..." : "Receive Stock"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
