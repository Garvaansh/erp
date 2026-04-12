"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { receiveStock } from "@/lib/api/inventory";
import { ApiClientError } from "@/lib/api/api-client";
import { inventoryKeys } from "@/lib/react-query/keys";

export function ReceiveStockForm() {
  const queryClient = useQueryClient();
  const [state, setState] = useState({ ok: false, message: "" });

  const receiveMutation = useMutation({
    mutationFn: receiveStock,
    onError: (error) => {
      if (error instanceof ApiClientError && error.message.trim()) {
        setState({ ok: false, message: error.message });
        return;
      }

      if (error instanceof Error && error.message.trim()) {
        setState({ ok: false, message: error.message });
        return;
      }

      setState({ ok: false, message: "Failed to receive stock." });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const itemID = String(formData.get("item_id") ?? "").trim();
    const quantity = Number(formData.get("quantity") ?? 0);

    receiveMutation.mutate(
      {
        item_id: itemID,
        quantity,
      },
      {
        onSuccess: async () => {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: inventoryKeys.snapshot(),
            }),
            queryClient.invalidateQueries({
              queryKey: inventoryKeys.activeBatches(itemID),
            }),
          ]);

          setState({ ok: true, message: "Stock received successfully." });
          event.currentTarget.reset();
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receive Stock</CardTitle>
        <CardDescription>
          Mutation flow: component to feature action to feature API to BFF.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="item_id">Item ID</Label>
            <Input id="item_id" name="item_id" required />
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
            <Button type="submit" disabled={receiveMutation.isPending}>
              {receiveMutation.isPending ? "Receiving..." : "Receive Stock"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
