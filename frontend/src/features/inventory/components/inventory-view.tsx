"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listActiveBatches } from "@/features/inventory/api";
import {
  defineAndReceiveAction,
  logProductionAction,
  receiveStockAction,
} from "@/features/inventory/actions";
import { ItemDrillDown } from "@/features/inventory/components/item-drill-down";
import type {
  ActiveBatch,
  InventoryActionState,
  InventorySnapshot,
  ItemDefinition,
  InventoryViewRow,
  SelectableItem,
} from "@/features/inventory/types";

type InventoryTab = "raw" | "wip" | "finished";

type InventoryViewProps = {
  snapshot: InventorySnapshot;
  selectableItems: SelectableItem[];
  rawItems: ItemDefinition[];
  initialTab: InventoryTab;
  serviceAlert?: string;
};

type MessageTone = "success" | "error";

type BannerMessage = {
  tone: MessageTone;
  text: string;
};

type FinishedFilter = "SELLABLE" | "SCRAP";

function readNumberSpec(specs: Record<string, unknown>, key: string): number {
  const value = specs[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatCompactSpecs(specs: Record<string, unknown>): string {
  const thickness = readNumberSpec(specs, "thickness");
  const width = readNumberSpec(specs, "width");
  const diameter = readNumberSpec(specs, "diameter");

  if (diameter > 0) {
    return `${formatNumber(thickness)} mm x ${formatNumber(width)} mm x ${formatNumber(diameter)} mm`;
  }

  return `${formatNumber(thickness)} mm x ${formatNumber(width)} mm`;
}

function formatNumber(value: number, maxFractionDigits = 4): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}

function formatKg(value: number): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)} kg`;
}

function applyActionResult(
  result: InventoryActionState,
  setBanner: (value: BannerMessage | null) => void,
): boolean {
  setBanner({
    tone: result.ok ? "success" : "error",
    text: result.message,
  });

  return result.ok;
}

function parseTab(value: string | null | undefined): InventoryTab {
  if (value === "wip" || value === "finished") {
    return value;
  }

  return "raw";
}

export function InventoryView({
  snapshot,
  selectableItems,
  rawItems,
  initialTab,
  serviceAlert,
}: InventoryViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<InventoryTab>(initialTab);
  const [banner, setBanner] = useState<BannerMessage | null>(null);
  const [finishedFilter, setFinishedFilter] =
    useState<FinishedFilter>("SELLABLE");

  const [defineOpen, setDefineOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownItemId, setDrillDownItemId] = useState<string>("");

  const wipRows = snapshot.SEMI_FINISHED;
  const finishedRows =
    finishedFilter === "SELLABLE" ? snapshot.FINISHED : snapshot.SCRAP;

  const rawStockByItemId = useMemo(() => {
    const map = new Map<string, number>();

    for (const row of snapshot.RAW) {
      map.set(row.item_id, row.total_qty);
    }

    return map;
  }, [snapshot.RAW]);

  const rawDefinitions = useMemo(
    () => [...rawItems].sort((a, b) => a.name.localeCompare(b.name)),
    [rawItems],
  );

  const rawSelectableItems = useMemo(
    () => selectableItems.filter((item) => item.category === "RAW"),
    [selectableItems],
  );

  const rawItemById = useMemo(() => {
    const map = new Map<string, ItemDefinition>();
    for (const item of rawDefinitions) {
      map.set(item.id, item);
    }
    return map;
  }, [rawDefinitions]);

  const drillDownItem = useMemo(
    () => rawDefinitions.find((item) => item.id === drillDownItemId) ?? null,
    [drillDownItemId, rawDefinitions],
  );

  const [defineForm, setDefineForm] = useState({
    name: "",
    thickness: "",
    width: "",
    diameter: "",
  });

  const [receiveForm, setReceiveForm] = useState({
    item_id: rawSelectableItems[0]?.item_id ?? "",
    weight: "",
  });

  const [selectedWipItemId, setSelectedWipItemId] = useState<string>(
    wipRows[0]?.item_id ?? "",
  );
  const [activeBatches, setActiveBatches] = useState<ActiveBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const selectedWipRow = useMemo(
    () => wipRows.find((row) => row.item_id === selectedWipItemId) ?? null,
    [wipRows, selectedWipItemId],
  );

  const [logForm, setLogForm] = useState({
    source_batch_id: "",
    output_item_name: "",
    output_specs_thickness: "",
    output_specs_width: "",
    output_specs_coil_weight: "",
    input_qty: "",
    finished_qty: "",
    scrap_qty: "0",
  });

  useEffect(() => {
    const tabFromUrl = parseTab(
      searchParams.get("tab") ?? searchParams.get("lane"),
    );
    setActiveTab(tabFromUrl);
  }, [searchParams]);

  useEffect(() => {
    if (!rawSelectableItems.length) {
      return;
    }

    setReceiveForm((current) => {
      const exists = rawSelectableItems.some(
        (item) => item.item_id === current.item_id,
      );
      return {
        ...current,
        item_id: exists ? current.item_id : rawSelectableItems[0].item_id,
      };
    });
  }, [rawSelectableItems]);

  useEffect(() => {
    if (!wipRows.length) {
      setSelectedWipItemId("");
      return;
    }

    setSelectedWipItemId((current) => current || wipRows[0].item_id);
  }, [wipRows]);

  useEffect(() => {
    if (!selectedWipRow) {
      setLogForm((current) => ({
        ...current,
        output_item_name: "",
      }));
      return;
    }

    setLogForm((current) => ({
      ...current,
      output_item_name: selectedWipRow.name,
      output_specs_thickness: String(
        readNumberSpec(selectedWipRow.specs, "thickness") || 1,
      ),
      output_specs_width: String(
        readNumberSpec(selectedWipRow.specs, "width") || 1,
      ),
      output_specs_coil_weight: String(
        readNumberSpec(selectedWipRow.specs, "coil_weight") || 1,
      ),
      input_qty: String(selectedWipRow.total_qty || 0),
      finished_qty: String(selectedWipRow.total_qty || 0),
    }));
  }, [selectedWipRow]);

  useEffect(() => {
    let cancelled = false;

    async function loadBatches() {
      if (!selectedWipItemId) {
        setActiveBatches([]);
        return;
      }

      setLoadingBatches(true);
      try {
        const rows = await listActiveBatches(selectedWipItemId);
        if (!cancelled) {
          setActiveBatches(rows);
          setLogForm((current) => ({
            ...current,
            source_batch_id: current.source_batch_id || rows[0]?.batch_id || "",
          }));
        }
      } catch {
        if (!cancelled) {
          setActiveBatches([]);
          setBanner({
            tone: "error",
            text: "Failed to load active batches for WIP item.",
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingBatches(false);
        }
      }
    }

    void loadBatches();

    return () => {
      cancelled = true;
    };
  }, [selectedWipItemId]);

  function setTabInUrl(nextTab: InventoryTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("lane");
    params.set("tab", nextTab);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  function onTabChange(value: string) {
    const nextTab = parseTab(value);
    setActiveTab(nextTab);
    setTabInUrl(nextTab);
  }

  function openLogForRow(row: InventoryViewRow) {
    setSelectedWipItemId(row.item_id);
    setLogOpen(true);
  }

  function openDrillDown(itemId: string) {
    setDrillDownItemId(itemId);
    setDrillDownOpen(true);
  }

  function onDefineSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await defineAndReceiveAction({
        name: defineForm.name,
        thickness: Number(defineForm.thickness),
        width: Number(defineForm.width),
        diameter: defineForm.diameter ? Number(defineForm.diameter) : undefined,
      });

      const ok = applyActionResult(result, setBanner);
      if (ok) {
        setDefineOpen(false);
        setDefineForm({ name: "", thickness: "", width: "", diameter: "" });
        router.refresh();
      }
    });
  }

  function onReceiveSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await receiveStockAction({
        item_id: receiveForm.item_id,
        weight: Number(receiveForm.weight),
      });

      const ok = applyActionResult(result, setBanner);
      if (ok) {
        setReceiveOpen(false);
        setReceiveForm((current) => ({
          ...current,
          weight: "",
        }));
        router.refresh();
      }
    });
  }

  function onLogSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await logProductionAction({
        source_batch_id: logForm.source_batch_id,
        output_item_name: logForm.output_item_name,
        output_item_specs: {
          thickness: Number(logForm.output_specs_thickness),
          width: Number(logForm.output_specs_width),
          coil_weight: Number(logForm.output_specs_coil_weight),
        },
        input_qty: Number(logForm.input_qty),
        finished_qty: Number(logForm.finished_qty),
        scrap_qty: Number(logForm.scrap_qty),
      });

      const ok = applyActionResult(result, setBanner);
      if (ok) {
        setLogOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {serviceAlert ? (
        <Card>
          <CardContent>
            <p>
              <Badge variant="destructive">SERVICE</Badge> {serviceAlert}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {banner ? (
        <Card>
          <CardContent>
            <p>
              <Badge
                variant={
                  banner.tone === "success" ? "secondary" : "destructive"
                }
              >
                {banner.tone === "success" ? "SUCCESS" : "ERROR"}
              </Badge>{" "}
              {banner.text}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Tabs value={activeTab} onValueChange={onTabChange}>
        <TabsList className="w-full justify-start gap-1 rounded-xl border border-border/70 bg-muted/40 p-1">
          <TabsTrigger value="raw" className="px-4">
            Raw Materials
          </TabsTrigger>
          <TabsTrigger value="wip" className="px-4">
            Under Processing
          </TabsTrigger>
          <TabsTrigger value="finished" className="px-4">
            Finished and Scrap
          </TabsTrigger>
        </TabsList>

        <TabsContent value="raw">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Raw Materials Definition Ledger</CardTitle>
                  <CardDescription>
                    Item-first master list with drill-down into physical stock
                    batches.
                  </CardDescription>
                </div>
                <Badge variant="outline">Raw Materials</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setDefineOpen(true)}
                  disabled={isPending}
                >
                  + Define Item
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setReceiveOpen(true)}
                  disabled={isPending}
                >
                  + Receive Stock
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Thickness</TableHead>
                      <TableHead>Width</TableHead>
                      <TableHead>Diameter</TableHead>
                      <TableHead className="text-right">Total Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rawDefinitions.length ? (
                      rawDefinitions.map((item) => (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer"
                          onClick={() => openDrillDown(item.id)}
                        >
                          <TableCell>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.sku || "SKU unavailable"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {formatNumber(
                              readNumberSpec(
                                item.specs as Record<string, unknown>,
                                "thickness",
                              ),
                            )}{" "}
                            mm
                          </TableCell>
                          <TableCell>
                            {formatNumber(
                              readNumberSpec(
                                item.specs as Record<string, unknown>,
                                "width",
                              ),
                            )}{" "}
                            mm
                          </TableCell>
                          <TableCell>
                            {readNumberSpec(
                              item.specs as Record<string, unknown>,
                              "diameter",
                            ) > 0
                              ? `${formatNumber(readNumberSpec(item.specs as Record<string, unknown>, "diameter"))} mm`
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatKg(rawStockByItemId.get(item.id) || 0)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5}>
                          No raw material definitions available.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wip">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Under Processing (WIP)</CardTitle>
                  <CardDescription>
                    Ongoing conversion area where semi-finished stock is
                    consumed and logged.
                  </CardDescription>
                </div>
                <Badge variant="outline">Work In Progress</Badge>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  if (!wipRows.length) {
                    setBanner({
                      tone: "error",
                      text: "No WIP rows available to log.",
                    });
                    return;
                  }
                  setLogOpen(true);
                }}
                disabled={isPending}
              >
                Log Production
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">WIP Qty</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wipRows.length ? (
                      wipRows.map((row) => (
                        <TableRow key={row.item_id}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell className="text-right">
                            {formatKg(row.total_qty)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => openLogForRow(row)}
                              disabled={isPending}
                            >
                              Finish Batch
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3}>
                          No active WIP batches.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finished">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Finished Goods and Scrap</CardTitle>
                  <CardDescription>
                    Final stage for sellable output and scrap recovery tracking.
                  </CardDescription>
                </div>
                <Badge variant="outline">Finished Output</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="fg_filter">View</Label>
                <Select
                  value={finishedFilter}
                  onValueChange={(value) =>
                    setFinishedFilter(value as FinishedFilter)
                  }
                >
                  <SelectTrigger id="fg_filter" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SELLABLE">Sellable</SelectItem>
                    <SelectItem value="SCRAP">Scrap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Specs</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finishedRows.length ? (
                      finishedRows.map((row) => (
                        <TableRow key={row.item_id}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>{formatCompactSpecs(row.specs)}</TableCell>
                          <TableCell className="text-right">
                            {formatKg(row.total_qty)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3}>
                          No records in this section.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ItemDrillDown
        item={drillDownItem}
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
      />

      <Dialog open={defineOpen} onOpenChange={setDefineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Define New Material</DialogTitle>
            <DialogDescription>
              SKU is generated automatically from thickness and width.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onDefineSubmit}>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="define_name">Name</Label>
                <Input
                  id="define_name"
                  value={defineForm.name}
                  onChange={(event) =>
                    setDefineForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="define_thickness">Thickness</Label>
                  <Input
                    id="define_thickness"
                    type="number"
                    step="0.0001"
                    value={defineForm.thickness}
                    onChange={(event) =>
                      setDefineForm((current) => ({
                        ...current,
                        thickness: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="define_width">Width</Label>
                  <Input
                    id="define_width"
                    type="number"
                    step="0.0001"
                    value={defineForm.width}
                    onChange={(event) =>
                      setDefineForm((current) => ({
                        ...current,
                        width: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="define_diameter">Diameter (optional)</Label>
                <Input
                  id="define_diameter"
                  type="number"
                  step="0.0001"
                  value={defineForm.diameter}
                  onChange={(event) =>
                    setDefineForm((current) => ({
                      ...current,
                      diameter: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDefineOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Defining..." : "Define Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive Stock</DialogTitle>
            <DialogDescription>
              Batch code and timestamps are generated by the backend.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onReceiveSubmit}>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="receive_item">Item</Label>
                <Select
                  value={receiveForm.item_id}
                  onValueChange={(value) =>
                    setReceiveForm((current) => ({
                      ...current,
                      item_id: value ?? "",
                    }))
                  }
                >
                  <SelectTrigger id="receive_item" className="w-full">
                    <SelectValue placeholder="Select raw item" />
                  </SelectTrigger>
                  <SelectContent>
                    {rawSelectableItems.map((item) => {
                      const rawItem = rawItemById.get(item.item_id);
                      const specs = rawItem?.specs as
                        | Record<string, unknown>
                        | undefined;
                      const primaryName =
                        rawItem?.name ||
                        item.label.split(" (")[0] ||
                        "Raw item";
                      const secondary = specs
                        ? `${formatNumber(readNumberSpec(specs, "thickness"))} mm x ${formatNumber(readNumberSpec(specs, "width"))} mm`
                        : "Specs unavailable";

                      return (
                        <SelectItem key={item.item_id} value={item.item_id}>
                          <div className="flex flex-col">
                            <span>{primaryName}</span>
                            <span className="text-xs text-muted-foreground">
                              {secondary}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="receive_weight">Quantity</Label>
                <Input
                  id="receive_weight"
                  type="number"
                  step="0.0001"
                  value={receiveForm.weight}
                  onChange={(event) =>
                    setReceiveForm((current) => ({
                      ...current,
                      weight: event.target.value,
                    }))
                  }
                  required
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReceiveOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !receiveForm.item_id}
              >
                {isPending ? "Receiving..." : "Receive"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Production</DialogTitle>
            <DialogDescription>
              Convert WIP into finished goods or scrap from a selected source
              batch.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onLogSubmit}>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="log_item">WIP Item</Label>
                <Select
                  value={selectedWipItemId}
                  onValueChange={(value) => setSelectedWipItemId(value ?? "")}
                >
                  <SelectTrigger id="log_item" className="w-full">
                    <SelectValue placeholder="Select WIP item" />
                  </SelectTrigger>
                  <SelectContent>
                    {wipRows.map((row) => (
                      <SelectItem key={row.item_id} value={row.item_id}>
                        {row.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="log_source_batch">Source Batch</Label>
                <Select
                  value={logForm.source_batch_id}
                  onValueChange={(value) =>
                    setLogForm((current) => ({
                      ...current,
                      source_batch_id: value ?? "",
                    }))
                  }
                >
                  <SelectTrigger id="log_source_batch" className="w-full">
                    <SelectValue
                      placeholder={
                        loadingBatches ? "Loading batches..." : "Select batch"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {activeBatches.map((batch) => (
                      <SelectItem key={batch.batch_id} value={batch.batch_id}>
                        {`${batch.batch_code} (${formatKg(batch.remaining_weight)} available)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="log_output_name">Output Name</Label>
                <Input
                  id="log_output_name"
                  value={logForm.output_item_name}
                  onChange={(event) =>
                    setLogForm((current) => ({
                      ...current,
                      output_item_name: event.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="log_specs_thickness">Thickness</Label>
                  <Input
                    id="log_specs_thickness"
                    type="number"
                    step="0.0001"
                    value={logForm.output_specs_thickness}
                    onChange={(event) =>
                      setLogForm((current) => ({
                        ...current,
                        output_specs_thickness: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="log_specs_width">Width</Label>
                  <Input
                    id="log_specs_width"
                    type="number"
                    step="0.0001"
                    value={logForm.output_specs_width}
                    onChange={(event) =>
                      setLogForm((current) => ({
                        ...current,
                        output_specs_width: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="log_specs_coil_weight">Coil Weight</Label>
                <Input
                  id="log_specs_coil_weight"
                  type="number"
                  step="0.0001"
                  value={logForm.output_specs_coil_weight}
                  onChange={(event) =>
                    setLogForm((current) => ({
                      ...current,
                      output_specs_coil_weight: event.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="log_input_qty">Input Qty</Label>
                  <Input
                    id="log_input_qty"
                    type="number"
                    step="0.0001"
                    value={logForm.input_qty}
                    onChange={(event) =>
                      setLogForm((current) => ({
                        ...current,
                        input_qty: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="log_finished_qty">Finished Qty</Label>
                  <Input
                    id="log_finished_qty"
                    type="number"
                    step="0.0001"
                    value={logForm.finished_qty}
                    onChange={(event) =>
                      setLogForm((current) => ({
                        ...current,
                        finished_qty: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="log_scrap_qty">Scrap Qty</Label>
                  <Input
                    id="log_scrap_qty"
                    type="number"
                    step="0.0001"
                    value={logForm.scrap_qty}
                    onChange={(event) =>
                      setLogForm((current) => ({
                        ...current,
                        scrap_qty: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isPending || !logForm.source_batch_id || !selectedWipRow
                }
              >
                {isPending ? "Logging..." : "Finish Batch"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
