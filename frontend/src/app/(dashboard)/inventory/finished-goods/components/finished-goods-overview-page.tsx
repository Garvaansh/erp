"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { ApiClientError } from "@/lib/api/api-client";
import {
  createFinishedGood,
  getSelectableRawItems,
} from "@/lib/api/inventory";
import { invalidateFinishedGoodsQueries } from "@/features/inventory/cache";
import { useFinishedGoodsMaster } from "@/features/inventory/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { inventoryKeys } from "@/lib/react-query/keys";

function formatQuantity(value: number): string {
  return `${value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} kg`;
}

function formatDiameter(value: number): string {
  return `${value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} mm`;
}

function statusVariant(status: "OK" | "LOW" | "OUT") {
  switch (status) {
    case "LOW":
      return "secondary" as const;
    case "OUT":
      return "destructive" as const;
    default:
      return "default" as const;
  }
}

export function FinishedGoodsOverviewPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const finishedGoodsQuery = useFinishedGoodsMaster();
  const filteredRows = useMemo(() => {
    const rows = finishedGoodsQuery.data ?? [];
    const query = search.trim().toLowerCase();
    if (!query) {
      return rows;
    }

    return rows.filter((row) =>
      [row.sku, row.name, row.status, String(row.diameter)].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [finishedGoodsQuery.data, search]);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div className="space-y-1">
          <h2 className="text-body-lg font-medium text-foreground">
            Finished Goods Overview
          </h2>
          <p className="text-caption text-muted-foreground mt-1">
            Product identity and aggregated stock for finished curtain pipes.
          </p>
        </div>
        <AddFinishedGoodDialog />
      </header>

      <section className="rounded-[16px] border border-border bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border bg-muted/20 px-5 py-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search SKU, product, diameter..."
              className="pl-10 rounded-full border-border bg-card/50 focus-visible:ring-primary/20"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Diameter</TableHead>
                <TableHead className="text-right">Available Qty</TableHead>
                <TableHead className="text-right">Reserved Qty</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow
                  key={row.item_id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() =>
                    router.push(`/inventory/finished-goods/${row.item_id}`)
                  }
                >
                  <TableCell className="font-mono text-[13px] text-muted-foreground pl-5">{row.sku}</TableCell>
                  <TableCell className="font-medium text-[15px]">{row.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDiameter(row.diameter)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatQuantity(row.available_qty)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatQuantity(row.reserved_qty)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}

              {!finishedGoodsQuery.isLoading && filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No finished goods found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function AddFinishedGoodDialog() {
  const queryClient = useQueryClient();
  const rawItemsQuery = useQuery({
    queryKey: inventoryKeys.selectableRawItems(),
    queryFn: getSelectableRawItems,
    staleTime: 30_000,
  });
  const [open, setOpen] = useState(false);
  const [selectedRawMaterialId, setSelectedRawMaterialId] = useState("");
  const [state, setState] = useState({
    ok: false,
    message: "",
  });
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setState({ ok: false, message: "" });

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);

    const name = String(formData.get("name") ?? "").trim();
    const diameter = Number(formData.get("diameter") ?? 0) || 0;
    const threshold = Number(formData.get("low_stock_threshold") ?? 0) || 0;

    if (!name || !selectedRawMaterialId || diameter <= 0) {
      setState({
        ok: false,
        message: "Product name, raw material, and diameter are required.",
      });
      setIsPending(false);
      return;
    }

    try {
      const item = await createFinishedGood({
        name,
        linked_raw_material_id: selectedRawMaterialId,
        diameter,
        low_stock_threshold: threshold,
      });

      if (!item) {
        setState({ ok: false, message: "Service unavailable." });
        setIsPending(false);
        return;
      }

      await invalidateFinishedGoodsQueries(queryClient, item.id);

      setState({ ok: true, message: "Finished good created successfully." });
      formElement.reset();
      setSelectedRawMaterialId("");
      setOpen(false);
    } catch (error) {
      if (error instanceof ApiClientError && error.message.trim()) {
        setState({ ok: false, message: error.message });
      } else if (error instanceof Error && error.message.trim()) {
        setState({ ok: false, message: error.message });
      } else {
        setState({ ok: false, message: "Service unavailable." });
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 size-4" />
        Add Finished Good
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Finished Good</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="finished-name">Product Name</Label>
            <Input
              id="finished-name"
              name="name"
              required
              placeholder="e.g. Curtain Pipe 25mm"
            />
          </div>

          <div className="space-y-1">
            <Label>Linked Raw Material</Label>
            <Select
              value={selectedRawMaterialId}
              onValueChange={(value) => setSelectedRawMaterialId(value ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select raw material" />
              </SelectTrigger>
              <SelectContent>
                {rawItemsQuery.data?.map((item) => (
                  <SelectItem key={item.item_id} value={item.item_id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="finished-diameter">Diameter (mm)</Label>
              <Input
                id="finished-diameter"
                name="diameter"
                type="number"
                min="0.01"
                step="0.01"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="finished-threshold">Low Stock Threshold</Label>
              <Input
                id="finished-threshold"
                name="low_stock_threshold"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
              />
            </div>
          </div>

          {state.message ? (
            <p
              className={`text-sm ${state.ok ? "text-emerald-600" : "text-red-600"}`}
            >
              {state.message}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
