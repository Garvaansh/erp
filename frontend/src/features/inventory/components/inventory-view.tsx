"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Filter, Plus, Search } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createItemDefinition } from "@/lib/api/inventory";
import { ApiClientError } from "@/lib/api/api-client";
import { inventoryKeys } from "@/lib/react-query/keys";
import type {
  InventorySnapshot,
  InventoryViewRow,
} from "@/features/inventory/types";
import { ItemDrillDown } from "@/features/inventory/components/item-drill-down";
import { WIPActivityTab } from "@/features/inventory/components/wip-activity-tab";

type InventoryTab = "raw" | "wip" | "finished";

type InventoryViewProps = {
  snapshot: InventorySnapshot;
  initialTab: InventoryTab;
  isAdmin: boolean;
  serviceAlert?: string;
};

type RowWithCategory = InventoryViewRow & {
  category: "RAW" | "SEMI_FINISHED" | "FINISHED";
};

function formatSpec(specs: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof specs.thickness === "number") {
    parts.push(`${specs.thickness}mm`);
  }
  if (typeof specs.width === "number") {
    parts.push(`${specs.width}mm`);
  }
  if (typeof specs.diameter === "number") {
    parts.push(`Ø${specs.diameter}mm`);
  }
  return parts.join(" x ") || "-";
}

function stockStatus(availableQty: number): "In Stock" | "Low" | "Exhausted" {
  if (availableQty <= 0) {
    return "Exhausted";
  }
  if (availableQty < 500) {
    return "Low";
  }
  return "In Stock";
}

function statusClass(status: "In Stock" | "Low" | "Exhausted"): string {
  if (status === "In Stock") {
    return "text-emerald-600";
  }
  if (status === "Low") {
    return "text-amber-600";
  }
  return "text-red-600";
}

export function InventoryView({
  snapshot,
  initialTab,
  isAdmin,
  serviceAlert,
}: InventoryViewProps) {
  const [activeTab, setActiveTab] = useState<InventoryTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRow, setSelectedRow] = useState<RowWithCategory | null>(null);

  const rawRows = useMemo<RowWithCategory[]>(
    () =>
      snapshot.RAW.map((row) => ({
        ...row,
        category: "RAW",
      })),
    [snapshot.RAW],
  );

  const finishedRows = useMemo<RowWithCategory[]>(
    () => [
      ...snapshot.SEMI_FINISHED.map((row) => ({
        ...row,
        category: "SEMI_FINISHED" as const,
      })),
      ...snapshot.FINISHED.map((row) => ({
        ...row,
        category: "FINISHED" as const,
      })),
    ],
    [snapshot.FINISHED, snapshot.SEMI_FINISHED],
  );

  const filteredRawRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return rawRows;
    }

    return rawRows.filter(
      (row) =>
        row.name.toLowerCase().includes(query) ||
        (row.sku ?? "").toLowerCase().includes(query) ||
        formatSpec(row.specs).toLowerCase().includes(query),
    );
  }, [rawRows, searchQuery]);

  const filteredFinishedRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return finishedRows;
    }

    return finishedRows.filter(
      (row) =>
        row.name.toLowerCase().includes(query) ||
        (row.sku ?? "").toLowerCase().includes(query) ||
        formatSpec(row.specs).toLowerCase().includes(query),
    );
  }, [finishedRows, searchQuery]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="erp-section-title">Inventory</p>
          <h1 className="text-2xl font-semibold text-foreground">
            Item Master
          </h1>
        </div>
      </div>

      {serviceAlert ? (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-700">
          <AlertTriangle className="size-4" />
          <span>{serviceAlert}</span>
        </div>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as InventoryTab)}
      >
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="raw">Raw Material</TabsTrigger>
          <TabsTrigger value="wip">WIP</TabsTrigger>
          <TabsTrigger value="finished">Finished Goods</TabsTrigger>
        </TabsList>

        <TabsContent value="raw" className="space-y-4 pt-2">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative min-w-72 flex-1 max-w-xl">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search SKU, description, or specification"
                  className="pl-9"
                />
              </div>
              <Button variant="outline" disabled>
                <Filter className="mr-2 size-4" />
                Filters
              </Button>
            </div>
            <AddRawMaterialDialog />
          </div>

          <InventoryTable
            rows={filteredRawRows}
            emptyText="No raw material rows found."
            showType={false}
            onRowClick={setSelectedRow}
          />
        </TabsContent>

        <TabsContent value="wip" className="space-y-4 pt-2">
          <WIPActivityTab isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="finished" className="space-y-4 pt-2">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative min-w-72 flex-1 max-w-xl">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search finished/semi-finished output"
                  className="pl-9"
                />
              </div>
              <Button variant="outline" disabled>
                <Filter className="mr-2 size-4" />
                Filters
              </Button>
            </div>
          </div>

          <InventoryTable
            rows={filteredFinishedRows}
            emptyText="No finished goods rows found."
            showType={true}
            onRowClick={setSelectedRow}
          />
        </TabsContent>
      </Tabs>

      <ItemDrillDown
        item={
          selectedRow
            ? {
                id: selectedRow.item_id,
                name: selectedRow.name,
                category: selectedRow.category,
                base_unit: "WEIGHT",
                specs: {
                  thickness: Number(selectedRow.specs?.thickness) || 0,
                  width: Number(selectedRow.specs?.width) || 0,
                  coil_weight: Number(selectedRow.specs?.coil_weight) || 0,
                },
                is_active: true,
              }
            : null
        }
        open={selectedRow !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRow(null);
          }
        }}
      />
    </div>
  );
}

type InventoryTableProps = {
  rows: RowWithCategory[];
  emptyText: string;
  showType: boolean;
  onRowClick: (row: RowWithCategory) => void;
};

function InventoryTable({
  rows,
  emptyText,
  showType,
  onRowClick,
}: InventoryTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Current State</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Description</TableHead>
              {showType ? <TableHead>Type</TableHead> : null}
              <TableHead>Specification</TableHead>
              <TableHead className="text-right">Total Weight</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const status = stockStatus(row.available_qty);
              return (
                <TableRow
                  key={`${row.category}:${row.item_id}`}
                  className="cursor-pointer"
                  onClick={() => onRowClick(row)}
                >
                  <TableCell className="font-mono text-xs">
                    {row.sku || "-"}
                  </TableCell>
                  <TableCell>{row.name}</TableCell>
                  {showType ? (
                    <TableCell>
                      {row.category === "SEMI_FINISHED"
                        ? "Semi-Finished"
                        : "Finished"}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-xs text-muted-foreground">
                    {formatSpec(row.specs)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {row.total_qty.toFixed(4)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {row.available_qty.toFixed(4)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {row.reserved_qty.toFixed(4)}
                  </TableCell>
                  <TableCell
                    className={`text-xs font-medium ${statusClass(status)}`}
                  >
                    {status}
                  </TableCell>
                </TableRow>
              );
            })}

            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={showType ? 8 : 7}
                  className="text-center text-sm text-muted-foreground"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AddRawMaterialDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({
    ok: false,
    message: "",
  });

  const createItemMutation = useMutation({
    mutationFn: createItemDefinition,
    onError: (error) => {
      if (error instanceof ApiClientError && error.message.trim()) {
        setState({ ok: false, message: error.message });
        return;
      }

      if (error instanceof Error && error.message.trim()) {
        setState({ ok: false, message: error.message });
        return;
      }

      setState({ ok: false, message: "Service unavailable." });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);

    createItemMutation.mutate(
      {
        name: String(formData.get("name") ?? "").trim(),
        category: "RAW",
        base_unit: "WEIGHT",
        specs: {
          thickness: Number(formData.get("thickness") ?? 0) || 0,
          width: Number(formData.get("width") ?? 0) || 0,
          coil_weight: Number(formData.get("coil_weight") ?? 0) || 0,
        },
      },
      {
        onSuccess: async (item) => {
          if (!item) {
            setState({ ok: false, message: "Service unavailable." });
            return;
          }

          await queryClient.invalidateQueries({
            queryKey: inventoryKeys.snapshot(),
          });

          setState({ ok: true, message: "Item created successfully." });
          formElement.reset();
          setOpen(false);
        },
      },
    );
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
          <input type="hidden" name="item_type" value="COIL" />

          <div className="space-y-1">
            <Label htmlFor="raw-name">Material Name</Label>
            <Input
              id="raw-name"
              name="name"
              required
              placeholder="e.g. Hot Rolled Carbon Steel Coil"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="raw-thickness">Thickness (mm)</Label>
              <Input
                id="raw-thickness"
                name="thickness"
                type="number"
                step="0.01"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="raw-width">Width (mm)</Label>
              <Input
                id="raw-width"
                name="width"
                type="number"
                step="0.01"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="raw-coil-weight">Initial Weight (MT)</Label>
            <Input
              id="raw-coil-weight"
              name="coil_weight"
              type="number"
              step="0.01"
              required
            />
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
            <Button type="submit" disabled={createItemMutation.isPending}>
              {createItemMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
