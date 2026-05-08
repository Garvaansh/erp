"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Search } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createItemDefinition, getRawMaterialMaster } from "@/lib/api/inventory";
import { ApiClientError } from "@/lib/api/api-client";
import { inventoryKeys } from "@/lib/react-query/keys";
import {
  formatSpecification,
  computeStockStatus,
  stockStatusLabel,
  stockStatusColor,
} from "@/lib/format-spec";
import type {
  InventorySnapshot,
  InventoryViewRow,
  RawMaterialMasterRow,
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

function statusBadgeVariant(
  status: "LOW" | "OK",
): "default" | "secondary" | "destructive" {
  switch (status) {
    case "OK":
      return "default";
    case "LOW":
      return "secondary";
  }
  return "default";
}

export function InventoryView({
  snapshot,
  initialTab,
  isAdmin,
  serviceAlert,
}: InventoryViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<InventoryTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRow, setSelectedRow] = useState<RowWithCategory | null>(null);

  const rawMaterialsQuery = useQuery({
    queryKey: inventoryKeys.rawMaterials(),
    queryFn: getRawMaterialMaster,
  });

  const rawMaterials = rawMaterialsQuery.data ?? [];

  const filteredRawMaterials = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rawMaterials;

    return rawMaterials.filter(
      (row) =>
        row.name.toLowerCase().includes(query) ||
        row.sku.toLowerCase().includes(query) ||
        row.specification.toLowerCase().includes(query),
    );
  }, [rawMaterials, searchQuery]);

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

  const filteredFinishedRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return finishedRows;

    return finishedRows.filter(
      (row) =>
        row.name.toLowerCase().includes(query) ||
        (row.sku ?? "").toLowerCase().includes(query) ||
        formatSpecification(row.specs).toLowerCase().includes(query),
    );
  }, [finishedRows, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Inventory</h1>
      </div>

      {serviceAlert ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-3.5 shrink-0" />
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

        <TabsContent value="raw" className="pt-3">
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search SKU, material, specification…"
                  className="pl-9 h-8 text-[13px]"
                />
              </div>
              <div className="flex-1" />
              <AddRawMaterialDialog />
            </div>
            <RawMaterialMasterTable
              rows={filteredRawMaterials}
              isLoading={rawMaterialsQuery.isFetching}
              onRowClick={(row) =>
                router.push(`/inventory/raw-materials/${row.item_id}`)
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="wip" className="space-y-4 pt-2">
          <WIPActivityTab isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="finished" className="pt-3">
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search finished output…"
                  className="pl-9 h-8 text-[13px]"
                />
              </div>
            </div>
            <InventoryTable
              rows={filteredFinishedRows}
              emptyText="No finished goods rows found."
              showType={true}
              onRowClick={setSelectedRow}
            />
          </div>
        </TabsContent>
      </Tabs>

      <ItemDrillDown
        item={
          selectedRow
            ? {
                id: selectedRow.item_id,
                name: selectedRow.name,
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

type RawMaterialMasterTableProps = {
  rows: RawMaterialMasterRow[];
  isLoading: boolean;
  onRowClick: (row: RawMaterialMasterRow) => void;
};

function RawMaterialMasterTable({
  rows,
  isLoading,
  onRowClick,
}: RawMaterialMasterTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>Material</TableHead>
            <TableHead>Specification</TableHead>
            <TableHead className="text-right">Available Stock</TableHead>
            <TableHead className="text-right">Threshold</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            return (
              <TableRow
                key={row.item_id}
                className="cursor-pointer"
                onClick={() => onRowClick(row)}
              >
                <TableCell className="font-mono text-xs">
                  {row.sku || "—"}
                </TableCell>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {row.specification || "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {row.available_qty.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{" "}
                  kg
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {row.threshold > 0
                    ? `${row.threshold.toLocaleString()} kg`
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                </TableCell>
              </TableRow>
            );
          })}

          {!isLoading && rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-sm text-muted-foreground"
              >
                No raw materials found.
              </TableCell>
            </TableRow>
          ) : null}

          {isLoading && rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-sm text-muted-foreground"
              >
                Loading raw materials…
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
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
    <div className="overflow-x-auto">
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
            const status = computeStockStatus(row.available_qty, 0);
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
                  {formatSpecification(row.specs)}
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
                <TableCell>
                  <span
                    className={`text-xs font-medium ${stockStatusColor(status)}`}
                  >
                    {stockStatusLabel(status)}
                  </span>
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
    const thicknessMm = Number(formData.get("thickness_mm") ?? 0) || 0;
    const widthMm = Number(formData.get("width_mm") ?? 0) || 0;
    const threshold = Number(formData.get("low_stock_threshold") ?? 0) || 0;

    if (!name || thicknessMm <= 0 || widthMm <= 0) {
      setState({
        ok: false,
        message: "Material name, thickness, and width are required.",
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
          thickness_mm: thicknessMm,
          width_mm: widthMm,
        },
        low_stock_threshold: threshold,
      });

      if (!item) {
        setState({ ok: false, message: "Service unavailable." });
        setIsPending(false);
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: inventoryKeys.rawMaterials(),
      });
      await queryClient.invalidateQueries({
        queryKey: inventoryKeys.snapshot(),
      });

      setState({ ok: true, message: "Material created successfully." });
      formElement.reset();
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
              placeholder="e.g. Stainless Steel Coil"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="raw-thickness">Thickness (mm)</Label>
              <Input
                id="raw-thickness"
                name="thickness_mm"
                type="number"
                step="0.01"
                min="0.01"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="raw-width">Width (mm)</Label>
              <Input
                id="raw-width"
                name="width_mm"
                type="number"
                step="0.01"
                min="0.01"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="raw-threshold">Low Stock Threshold (kg)</Label>
            <Input
              id="raw-threshold"
              name="low_stock_threshold"
              type="number"
              step="1"
              min="0"
              defaultValue="0"
              placeholder="e.g. 1000"
            />
            <p className="text-xs text-muted-foreground">
              Alert when available stock falls below this weight.
            </p>
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
