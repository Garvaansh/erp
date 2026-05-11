"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { ApiClientError } from "@/lib/api/api-client";
import { createItemDefinition } from "@/lib/api/inventory";
import { invalidateRawMaterialQueries } from "@/features/inventory/cache";
import { useRawMaterialMaster } from "@/features/inventory/queries";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { inventoryKeys } from "@/lib/react-query/keys";

function formatKg(value: number): string {
  return `${value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} kg`;
}

function statusVariant(status: "LOW" | "OK"): "secondary" | "default" {
  return status === "LOW" ? "secondary" : "default";
}

export function RawMaterialsOverviewPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const materialsQuery = useRawMaterialMaster();
  const rows = materialsQuery.data ?? [];

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return rows;
    }

    return rows.filter((row) =>
      [row.sku, row.name, row.specification, row.status].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">
            Raw Materials
          </h1>
          <p className="text-sm text-muted-foreground">
            Operational inventory view for available stock, reservations, and
            procurement coverage.
          </p>
        </div>
        <AddRawMaterialDialog />
      </header>

      <section className="rounded-xl border bg-background">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search SKU, material, specification"
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Material Name</TableHead>
                <TableHead>Specification</TableHead>
                <TableHead className="text-right">Available Qty</TableHead>
                <TableHead className="text-right">Reserved Qty</TableHead>
                <TableHead className="text-right">Threshold</TableHead>
                <TableHead className="text-right">Pending Deliveries</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow
                  key={row.item_id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/inventory/raw-materials/${row.item_id}`)
                  }
                >
                  <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.specification || "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatKg(row.available_qty)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatKg(row.reserved_qty)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatKg(row.threshold)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatKg(row.pending_deliveries)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)}>
                      {row.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}

              {!materialsQuery.isLoading && filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No raw materials found.
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

function AddRawMaterialDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
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
    const thickness = Number(formData.get("thickness") ?? 0) || 0;
    const width = Number(formData.get("width") ?? 0) || 0;
    const threshold = Number(formData.get("low_stock_threshold") ?? 0) || 0;

    if (!name) {
      setState({
        ok: false,
        message: "Material name is required.",
      });
      setIsPending(false);
      return;
    }

    if (thickness <= 0 && width <= 0) {
      setState({
        ok: false,
        message: "At least one dimension (thickness or width) is required.",
      });
      setIsPending(false);
      return;
    }

    try {
      const item = await createItemDefinition({
        name,
        category: "RAW",
        base_unit: "WEIGHT",
        specs: {
          thickness: thickness > 0 ? thickness : undefined,
          width: width > 0 ? width : undefined,
        },
        low_stock_threshold: threshold > 0 ? threshold : undefined,
      });

      if (!item) {
        setState({ ok: false, message: "Service unavailable." });
        setIsPending(false);
        return;
      }

      await invalidateRawMaterialQueries(queryClient, item.id);
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
        Add Raw Material
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Raw Material</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="raw-name">Material Name</Label>
            <Input
              id="raw-name"
              name="name"
              required
              placeholder="e.g. Stainless Steel 304"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="raw-thickness">Thickness (mm)</Label>
              <Input
                id="raw-thickness"
                name="thickness"
                type="number"
                min="0.01"
                step="0.01"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="raw-width">Width (mm)</Label>
              <Input
                id="raw-width"
                name="width"
                type="number"
                min="0.01"
                step="0.01"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="raw-threshold">Low Stock Threshold (kg)</Label>
            <Input
              id="raw-threshold"
              name="low_stock_threshold"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
            />
          </div>

          {state.message ? (
            <p className="text-sm text-red-600">{state.message}</p>
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
