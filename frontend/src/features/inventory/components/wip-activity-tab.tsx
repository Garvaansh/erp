"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { AlertTriangle, CheckCircle2, Dot } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ApiClientError } from "@/lib/api-client";
import {
  approvePendingApproval,
  getWIPActivityEntries,
  getWIPLots,
  getWIPSelectableItems,
  rejectPendingApproval,
  submitMolding,
  submitPolishing,
} from "@/features/wip/api";
import {
  calculateDifference,
  calculateTolerance,
} from "@/features/wip/mass-balance";
import type {
  WIPActivityEntry,
  WIPLotOption,
  WIPSelectableItem,
} from "@/features/wip/types";
import { formatBatchOptionLabel, getPolishingAutoSku } from "@/features/wip/ui";

const DECIMAL_INPUT_PATTERN = /^\d*(\.\d{0,4})?$/;
const DIAMETER_CACHE_KEY = "wip:last-diameter-by-sku";

type Workstation = "MOLDING" | "POLISHING";

type FormState = {
  workstation: Workstation;
  item_id: string;
  source_batch_id: string;
  input_qty: string;
  output_qty: string;
  scrap_qty: string;
  short_qty: string;
  reason: string;
  diameter: string;
};

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateDaysAgoISO(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function sanitizeDecimalInput(previous: string, next: string): string {
  const value = next.trim();
  if (value === "") {
    return "";
  }
  if (!DECIMAL_INPUT_PATTERN.test(value)) {
    return previous;
  }
  return value;
}

function toNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toFourDecimals(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.0000";
  }
  return value.toFixed(4);
}

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return error.message || fallback;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function parseDiameterCache(raw: string | null): Record<string, string> {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return Object.entries(parsed).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        if (typeof value === "string" && key.trim()) {
          acc[key] = value;
        }
        return acc;
      },
      {},
    );
  } catch {
    return {};
  }
}

function statusColor(status: WIPActivityEntry["status"]): string {
  if (status === "BALANCED") {
    return "text-emerald-500";
  }
  if (status === "TOLERANCE") {
    return "text-amber-500";
  }
  return "text-red-500";
}

function statusLabel(status: WIPActivityEntry["status"]): string {
  if (status === "BALANCED") {
    return "Balanced";
  }
  if (status === "TOLERANCE") {
    return "Tolerance";
  }
  return "Flagged";
}

type WIPActivityTabProps = {
  isAdmin?: boolean;
};

export function WIPActivityTab({ isAdmin = false }: WIPActivityTabProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    workstation: "MOLDING",
    item_id: "",
    source_batch_id: "",
    input_qty: "",
    output_qty: "",
    scrap_qty: "0",
    short_qty: "0",
    reason: "",
    diameter: "",
  });
  const [fromDate, setFromDate] = useState<string>(dateDaysAgoISO(6));
  const [toDate, setToDate] = useState<string>(todayISODate());

  const [items, setItems] = useState<WIPSelectableItem[]>([]);
  const [lots, setLots] = useState<WIPLotOption[]>([]);
  const [entries, setEntries] = useState<WIPActivityEntry[]>([]);

  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingLots, setLoadingLots] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actingJournalID, setActingJournalID] = useState<string | null>(null);

  const [diameterByItemID, setDiameterByItemID] = useState<
    Record<string, string>
  >({});

  const outputRef = useRef<HTMLInputElement>(null);
  const scrapRef = useRef<HTMLInputElement>(null);
  const shortRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLInputElement>(null);

  const stage = form.workstation === "MOLDING" ? "molding" : "polishing";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setDiameterByItemID(
      parseDiameterCache(window.localStorage.getItem(DIAMETER_CACHE_KEY)),
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      DIAMETER_CACHE_KEY,
      JSON.stringify(diameterByItemID),
    );
  }, [diameterByItemID]);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const rows = await getWIPSelectableItems(stage);
      setItems(rows);
    } catch (error) {
      toast.error(readErrorMessage(error, "Failed to load SKU options."));
    } finally {
      setLoadingItems(false);
    }
  }, [stage]);

  const loadLots = useCallback(
    async (itemID: string, stageOverride?: Workstation) => {
      const lookupStage =
        stageOverride === "MOLDING"
          ? "molding"
          : stageOverride === "POLISHING"
            ? "polishing"
            : stage;

      if (!itemID.trim() && lookupStage === "molding") {
        setLots([]);
        return;
      }

      setLoadingLots(true);
      try {
        const rows = await getWIPLots(itemID, lookupStage);
        setLots(rows);
      } catch (error) {
        toast.error(
          readErrorMessage(error, "Failed to load batches for selected SKU."),
        );
      } finally {
        setLoadingLots(false);
      }
    },
    [stage],
  );

  const loadEntries = useCallback(async () => {
    if (!fromDate || !toDate) {
      return;
    }
    if (fromDate > toDate) {
      toast.error("From date must be before To date.");
      return;
    }

    setLoadingEntries(true);
    try {
      const rows = await getWIPActivityEntries({
        from: fromDate,
        to: toDate,
        limit: 200,
      });
      setEntries(rows);
    } catch (error) {
      toast.error(readErrorMessage(error, "Failed to load WIP entries."));
    } finally {
      setLoadingEntries(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const selectedLot = useMemo(
    () => lots.find((lot) => lot.batch_id === form.source_batch_id),
    [lots, form.source_batch_id],
  );

  const inputQty = toNumber(form.input_qty);
  const outputQty = toNumber(form.output_qty);
  const scrapQty = toNumber(form.scrap_qty);
  const shortQty = toNumber(form.short_qty);

  const difference = useMemo(
    () => calculateDifference(inputQty, outputQty, scrapQty, shortQty),
    [inputQty, outputQty, scrapQty, shortQty],
  );

  const tolerance = useMemo(() => calculateTolerance(inputQty), [inputQty]);

  const remainingAfter = useMemo(() => {
    if (!selectedLot) {
      return 0;
    }
    return Math.max(selectedLot.remaining_weight - inputQty, 0);
  }, [selectedLot, inputQty]);

  const needsReason = difference > 0;
  const exceedsTolerance = difference > tolerance;
  const inputExceedsLot = Boolean(
    selectedLot && inputQty > selectedLot.remaining_weight,
  );

  const inputError = useMemo(() => {
    if (!form.input_qty.trim()) {
      return "Input weight is required.";
    }
    if (inputQty <= 0) {
      return "Input weight must be greater than zero.";
    }
    if (inputExceedsLot) {
      return "Input weight cannot exceed available batch quantity.";
    }
    return "";
  }, [form.input_qty, inputQty, inputExceedsLot]);

  const canSubmit =
    (form.workstation === "POLISHING" || Boolean(form.item_id)) &&
    Boolean(form.source_batch_id) &&
    Boolean(form.output_qty.trim()) &&
    !inputError &&
    (!needsReason || Boolean(form.reason.trim())) &&
    (form.workstation !== "MOLDING" || Boolean(form.diameter.trim()));

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitting) {
      return;
    }

    setSubmitting(true);
    try {
      const reason = form.reason.trim();

      if (form.workstation === "MOLDING") {
        const result = await submitMolding({
          source_batch_id: form.source_batch_id,
          input_weight: form.input_qty,
          molded_output: form.output_qty,
          scrap_qty: form.scrap_qty || "0",
          shortlength_qty: form.short_qty || "0",
          process_loss_qty: "0",
          diameter: form.diameter,
          note: reason,
        });

        toast.success(
          result.requires_approval
            ? "Submitted for approval"
            : "Production entry logged",
          {
            description: `Difference ${result.difference} kg, tolerance ${result.tolerance} kg`,
          },
        );
      } else {
        const result = await submitPolishing({
          source_batch_id: form.source_batch_id,
          molded_input: form.input_qty,
          finished_output: form.output_qty,
          polishing_scrap_qty: form.scrap_qty || "0",
          polishing_shortlength_qty: form.short_qty || "0",
          final_adjustment_qty: "0",
          note: reason,
        });

        toast.success(
          result.requires_approval
            ? "Submitted for approval"
            : "Production entry logged",
          {
            description: `Difference ${result.difference} kg, tolerance ${result.tolerance} kg`,
          },
        );
      }

      setForm((previous) => ({
        ...previous,
        source_batch_id: "",
        input_qty: "",
        output_qty: "",
        scrap_qty: "0",
        short_qty: "0",
        reason: "",
      }));

      await loadLots(form.workstation === "POLISHING" ? "" : form.item_id);
      await loadEntries();
    } catch (error) {
      toast.error(readErrorMessage(error, "Failed to log production entry."));
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, form, loadEntries, loadLots, submitting]);

  const handleEnterNext = useCallback(
    (
      event: KeyboardEvent<HTMLInputElement>,
      next?: React.RefObject<HTMLInputElement | null>,
    ) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      if (next?.current) {
        next.current.focus();
        return;
      }

      if (canSubmit) {
        void handleSubmit();
      }
    },
    [canSubmit, handleSubmit],
  );

  const handleAdminAction = useCallback(
    async (journalID: string, action: "approve" | "reject") => {
      if (!isAdmin || actingJournalID) {
        return;
      }

      setActingJournalID(journalID);
      try {
        if (action === "approve") {
          await approvePendingApproval(journalID);
          toast.success("Journal approved.");
        } else {
          await rejectPendingApproval(journalID);
          toast.success("Journal rejected and stock released.");
        }

        await loadEntries();
        await loadLots(form.workstation === "POLISHING" ? "" : form.item_id);
      } catch (error) {
        toast.error(
          readErrorMessage(error, `Failed to ${action} pending journal.`),
        );
      } finally {
        setActingJournalID(null);
      }
    },
    [actingJournalID, form.item_id, isAdmin, loadEntries, loadLots],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="wip-from-date">From Date</Label>
            <Input
              id="wip-from-date"
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wip-to-date">To Date</Label>
            <Input
              id="wip-to-date"
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              onClick={() => void loadEntries()}
              disabled={loadingEntries}
            >
              {loadingEntries ? "Filtering..." : "Filter"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push("/reports/production")}
            >
              Reports
            </Button>
          </div>
        </div>

        <Button
          onClick={() => {
            document
              .getElementById("wip-entry-form")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          + Log Production Entry
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]" id="wip-entry-form">
        <Card>
          <CardHeader>
            <CardTitle>Log Production Entry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <Label>Workstation</Label>
                <Select
                  value={form.workstation}
                  onValueChange={(value) => {
                    const nextWorkstation = (value ?? "MOLDING") as Workstation;
                    setForm((previous) => ({
                      ...previous,
                      workstation: nextWorkstation,
                      item_id: "",
                      source_batch_id: "",
                      diameter: "",
                    }));
                    setLots([]);
                    if (nextWorkstation === "POLISHING") {
                      void loadLots("", "POLISHING");
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select workstation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MOLDING">Molding</SelectItem>
                    <SelectItem value="POLISHING">Polishing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.workstation === "MOLDING" ? (
                <div className="space-y-1 md:col-span-2">
                  <Label>SKU</Label>
                  <Select
                    value={form.item_id}
                    onValueChange={(value) => {
                      const nextItemID = value ?? "";
                      setForm((previous) => ({
                        ...previous,
                        item_id: nextItemID,
                        source_batch_id: "",
                        diameter:
                          previous.workstation === "MOLDING"
                            ? previous.diameter ||
                              diameterByItemID[nextItemID] ||
                              ""
                            : "",
                      }));
                      void loadLots(nextItemID);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          loadingItems ? "Loading SKU..." : "Select SKU"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem key={item.item_id} value={item.item_id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1 md:col-span-2">
                  <Label>SKU (Auto-filled)</Label>
                  <Input
                    readOnly
                    value={getPolishingAutoSku(selectedLot?.sku)}
                    className="bg-muted/40"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label>Batch</Label>
              <Select
                value={form.source_batch_id}
                onValueChange={(value) =>
                  setForm((previous) => ({
                    ...previous,
                    source_batch_id: value ?? "",
                  }))
                }
              >
                <SelectTrigger
                  className="w-full"
                  disabled={form.workstation === "MOLDING" && !form.item_id}
                >
                  <SelectValue
                    placeholder={
                      loadingLots
                        ? "Loading batches..."
                        : form.workstation === "MOLDING" && form.item_id
                          ? "Select batch"
                          : form.workstation === "MOLDING"
                            ? "Select SKU first"
                            : "Select MWIP batch"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {lots.map((lot) => (
                    <SelectItem key={lot.batch_id} value={lot.batch_id}>
                      {formatBatchOptionLabel(lot)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLot ? (
                <p className="text-xs text-muted-foreground">
                  Available: {toFourDecimals(selectedLot.remaining_weight)} kg
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="wip-input-qty">Input Weight (kg)</Label>
                <Input
                  id="wip-input-qty"
                  value={form.input_qty}
                  inputMode="decimal"
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      input_qty: sanitizeDecimalInput(
                        previous.input_qty,
                        event.target.value,
                      ),
                    }))
                  }
                  onKeyDown={(event) => handleEnterNext(event, outputRef)}
                  placeholder="0.0000"
                />
                {inputError ? (
                  <p className="text-xs text-red-500">{inputError}</p>
                ) : null}
                {selectedLot && form.input_qty ? (
                  <p className="text-xs text-muted-foreground">
                    Remaining after entry: {toFourDecimals(remainingAfter)} kg
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label htmlFor="wip-output-qty">Output Weight (kg)</Label>
                <Input
                  ref={outputRef}
                  id="wip-output-qty"
                  value={form.output_qty}
                  inputMode="decimal"
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      output_qty: sanitizeDecimalInput(
                        previous.output_qty,
                        event.target.value,
                      ),
                    }))
                  }
                  onKeyDown={(event) => handleEnterNext(event, scrapRef)}
                  placeholder="0.0000"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="wip-scrap-qty">Scrap (kg)</Label>
                <Input
                  ref={scrapRef}
                  id="wip-scrap-qty"
                  value={form.scrap_qty}
                  inputMode="decimal"
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      scrap_qty: sanitizeDecimalInput(
                        previous.scrap_qty,
                        event.target.value,
                      ),
                    }))
                  }
                  onKeyDown={(event) => handleEnterNext(event, shortRef)}
                  placeholder="0.0000"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="wip-short-qty">Shortlength (kg)</Label>
                <Input
                  ref={shortRef}
                  id="wip-short-qty"
                  value={form.short_qty}
                  inputMode="decimal"
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      short_qty: sanitizeDecimalInput(
                        previous.short_qty,
                        event.target.value,
                      ),
                    }))
                  }
                  onKeyDown={(event) => handleEnterNext(event, reasonRef)}
                  placeholder="0.0000"
                />
              </div>

              {form.workstation === "MOLDING" ? (
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="wip-diameter">Diameter (mm)</Label>
                  <Input
                    id="wip-diameter"
                    value={form.diameter}
                    inputMode="decimal"
                    onChange={(event) => {
                      const nextDiameter = sanitizeDecimalInput(
                        form.diameter,
                        event.target.value,
                      );
                      setForm((previous) => ({
                        ...previous,
                        diameter: nextDiameter,
                      }));
                      if (form.item_id) {
                        setDiameterByItemID((previous) => ({
                          ...previous,
                          [form.item_id]: nextDiameter,
                        }));
                      }
                    }}
                    placeholder="0.0000"
                  />
                </div>
              ) : null}

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="wip-reason">Reason</Label>
                <Input
                  ref={reasonRef}
                  id="wip-reason"
                  value={form.reason}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      reason: event.target.value,
                    }))
                  }
                  onKeyDown={(event) => handleEnterNext(event)}
                  placeholder={
                    needsReason
                      ? "Reason required when difference is not zero"
                      : "Optional note"
                  }
                />
                {needsReason && !form.reason.trim() ? (
                  <p className="text-xs text-amber-500">
                    Reason is required when difference is not zero.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Button
                disabled={!canSubmit || submitting}
                onClick={() => void handleSubmit()}
              >
                {submitting
                  ? "Submitting..."
                  : exceedsTolerance
                    ? "Submit for Approval"
                    : "Submit"}
              </Button>
              {exceedsTolerance ? (
                <p className="text-xs text-red-500">
                  Difference exceeds tolerance threshold.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:sticky lg:top-20 lg:h-fit">
          <CardHeader>
            <CardTitle>Live Calculation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>Input</span>
              <span className="font-semibold">{toFourDecimals(inputQty)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>Output</span>
              <span className="font-semibold">{toFourDecimals(outputQty)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>Scrap</span>
              <span className="font-semibold">{toFourDecimals(scrapQty)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>Short</span>
              <span className="font-semibold">{toFourDecimals(shortQty)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>Total</span>
              <span className="font-semibold">
                {toFourDecimals(outputQty + scrapQty + shortQty)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>Difference</span>
              <span className="font-semibold">
                {toFourDecimals(difference)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>Tolerance</span>
              <span className="font-semibold">{toFourDecimals(tolerance)}</span>
            </div>

            <div
              className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                difference === 0
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                  : exceedsTolerance
                    ? "border-red-500/40 bg-red-500/10 text-red-600"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-600"
              }`}
            >
              {difference === 0 ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <AlertTriangle className="size-4" />
              )}
              <span className="text-xs font-medium">
                {difference === 0
                  ? "Perfect balance"
                  : exceedsTolerance
                    ? "Flagged: approval required"
                    : "Within tolerance: reason required"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date/Time</TableHead>
                <TableHead>Batch ID</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Workstation</TableHead>
                <TableHead className="text-right">Input</TableHead>
                <TableHead className="text-right">Output</TableHead>
                <TableHead className="text-right">Scrap</TableHead>
                <TableHead className="text-right">Short</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Operator</TableHead>
                {isAdmin ? <TableHead>Action</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((row) => (
                <TableRow key={row.journal_id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.batch_code}
                  </TableCell>
                  <TableCell>{row.item_sku || row.item_name}</TableCell>
                  <TableCell>{row.workstation}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {row.input_qty}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {row.output_qty}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {row.scrap_qty}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {row.short_qty}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {row.difference}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium ${statusColor(row.status)}`}
                    >
                      <Dot className="size-4" />
                      {statusLabel(row.status)}
                    </span>
                  </TableCell>
                  <TableCell>{row.operator_name || "—"}</TableCell>
                  {isAdmin ? (
                    <TableCell>
                      {row.approval_state === "PENDING_APPROVAL" ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            disabled={actingJournalID === row.journal_id}
                            onClick={() =>
                              void handleAdminAction(row.journal_id, "approve")
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={actingJournalID === row.journal_id}
                            onClick={() =>
                              void handleAdminAction(row.journal_id, "reject")
                            }
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}

              {!loadingEntries && entries.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 12 : 11}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No entries found for selected date range.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
