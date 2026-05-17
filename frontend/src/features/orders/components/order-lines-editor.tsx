"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { type FieldArrayWithId, type UseFieldArrayAppend, type UseFieldArrayRemove, type UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { SearchCombobox } from "@/features/orders/components/search-combobox";
import { formatCurrency, formatQuantity } from "@/features/orders/utils/format";
import { createDraftOrderLine } from "@/features/orders/stores/order-draft-store";
import type { OrderDraftFormValues } from "@/features/orders/schemas/order-schema";
import type { FinishedGoodMasterRow } from "@/features/inventory/types";

type OrderLinesEditorProps = {
  form: UseFormReturn<OrderDraftFormValues>;
  fields: FieldArrayWithId<OrderDraftFormValues, "lines", "id">[];
  append: UseFieldArrayAppend<OrderDraftFormValues, "lines">;
  remove: UseFieldArrayRemove;
  products: FinishedGoodMasterRow[];
};

function LineProductCell({
  index,
  form,
  products,
}: {
  index: number;
  form: UseFormReturn<OrderDraftFormValues>;
  products: FinishedGoodMasterRow[];
}) {
  const selectedId = form.watch(`lines.${index}.finished_good_item_id`);
  const selectedProduct = products.find((product) => product.item_id === selectedId);
  const [query, setQuery] = useState(
    selectedProduct
      ? `${selectedProduct.sku} · ${selectedProduct.name}`
      : "",
  );

  useEffect(() => {
    if (selectedProduct) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery(`${selectedProduct.sku} · ${selectedProduct.name}`);
    }
  }, [selectedProduct]);

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return products
      .filter((product) => {
        if (!needle) {
          return true;
        }

        return [product.sku, product.name]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .map((product) => ({
        value: product.item_id,
        label: `${product.sku} · ${product.name}`,
        description: `Available ${formatQuantity(product.available_qty)}`,
      }));
  }, [products, query]);

  return (
    <SearchCombobox
      value={selectedId}
      inputValue={query}
      onInputValueChange={setQuery}
      onSelect={(option) => {
        form.setValue(`lines.${index}.finished_good_item_id`, option.value, {
          shouldDirty: true,
          shouldValidate: true,
        });
        setQuery(option.label);
      }}
      options={options}
      placeholder="Search finished goods"
      emptyText="No finished goods found."
    />
  );
}

export function OrderLinesEditor({
  form,
  fields,
  append,
  remove,
  products,
}: OrderLinesEditorProps) {
  const lines = form.watch("lines");

  return (
    <div className="space-y-4 rounded-[24px] border bg-background px-4 py-4 md:px-6 md:py-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Order Lines
          </h3>
          <p className="text-sm text-muted-foreground">
            Add finished goods and quantities for this document.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append(createDraftOrderLine())}
        >
          <Plus className="mr-2 size-4" />
          Add Line
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[280px]">Product</TableHead>
              <TableHead>Available</TableHead>
              <TableHead className="min-w-[120px]">Qty</TableHead>
              <TableHead className="min-w-[140px]">Unit Price</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => {
              const selectedProduct = products.find(
                (product) => product.item_id === lines[index]?.finished_good_item_id,
              );
              const qty = Number(lines[index]?.ordered_qty || 0);
              const unitPrice = Number(lines[index]?.unit_price || 0);
              const lineTotal = qty * unitPrice;
              const qtyError = form.formState.errors.lines?.[index]?.ordered_qty?.message;
              const productError =
                form.formState.errors.lines?.[index]?.finished_good_item_id?.message;
              const priceError = form.formState.errors.lines?.[index]?.unit_price?.message;
              const exceedsAvailability =
                selectedProduct && qty > selectedProduct.available_qty;

              return (
                <TableRow key={field.id}>
                  <TableCell className="align-top">
                    <div className="space-y-1">
                      <LineProductCell index={index} form={form} products={products} />
                      {productError ? (
                        <p className="text-xs text-destructive">{productError}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-sm">
                    {selectedProduct ? (
                      <div className="space-y-1">
                        <div>{formatQuantity(selectedProduct.available_qty)}</div>
                        {exceedsAvailability ? (
                          <div className="text-xs text-destructive">
                            Only {formatQuantity(selectedProduct.available_qty)} available
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Select product</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      {...form.register(`lines.${index}.ordered_qty`, {
                        valueAsNumber: true,
                      })}
                      className={qtyError || exceedsAvailability ? "border-destructive" : ""}
                    />
                    {qtyError ? (
                      <p className="mt-1 text-xs text-destructive">{qtyError}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      {...form.register(`lines.${index}.unit_price`, {
                        valueAsNumber: true,
                      })}
                      className={priceError ? "border-destructive" : ""}
                    />
                    {priceError ? (
                      <p className="mt-1 text-xs text-destructive">{priceError}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top text-right font-medium">
                    {formatCurrency(lineTotal)}
                  </TableCell>
                  <TableCell className="align-top text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
