"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiClientError } from "@/lib/api/api-client";
import {
  approvePendingApproval,
  getPendingApprovals,
  getWIPLots,
  getWIPSelectableItems,
  rejectPendingApproval,
  submitMolding,
  submitPolishing,
} from "@/lib/api/wip";
import { inventoryKeys, wipKeys } from "@/lib/react-query/keys";
import type {
  MoldingPayload,
  PendingWIPApproval,
  PolishingPayload,
  WIPLotOption,
  WIPSelectableItem,
  WIPStage,
} from "@/features/wip/types";

const DECIMAL_INPUT_PATTERN = /^\d*(\.\d{0,4})?$/;
const DIAMETER_CACHE_KEY = "wip:last-diameter-by-sku";

type WIPProductionPageProps = {
  isAdmin: boolean;
};

type MoldingFormState = {
  item_id: string;
  source_batch_id: string;
  input_weight: string;
  molded_output: string;
  scrap_qty: string;
  shortlength_qty: string;
  process_loss_qty: string;
  diameter: string;
  note: string;
  sku_query: string;
  entry_date: string;
};

type PolishingFormState = {
  item_id: string;
  source_batch_id: string;
  molded_input: string;
  finished_output: string;
  polishing_scrap_qty: string;
  polishing_shortlength_qty: string;
  final_adjustment_qty: string;
  note: string;
  sku_query: string;
  entry_date: string;
};

type MassBalanceState = {
  input: number;
  expectedTotal: number;
  difference: number;
  toleranceEstimate: number;
  withinTolerance: boolean;
};

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toFourDecimal(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.0000";
  }

  return value.toFixed(4);
}

function getToleranceEstimate(input: number): number {
  if (input <= 0) {
    return 0;
  }

  const onePercent = input * 0.01;
  const fivePercentCap = input * 0.05;
  return Math.min(Math.max(2, onePercent), fivePercentCap);
}

function calculateMassBalance(
  input: string,
  output: string,
  scrap: string,
  shortlength: string,
  processLoss: string,
): MassBalanceState {
  const inputNumber = toNumber(input);
  const expectedTotal =
    toNumber(output) +
    toNumber(scrap) +
    toNumber(shortlength) +
    toNumber(processLoss);
  const difference = Math.abs(inputNumber - expectedTotal);
  const toleranceEstimate = getToleranceEstimate(inputNumber);

  return {
    input: inputNumber,
    expectedTotal,
    difference,
    toleranceEstimate,
    withinTolerance: inputNumber > 0 && difference <= toleranceEstimate,
  };
}

function ageLabelForDate(dateValue: string): string {
  const entryDate = new Date(`${dateValue}T00:00:00`);
  const ageHours = (Date.now() - entryDate.getTime()) / (1000 * 60 * 60);

  if (ageHours < 24) {
    return "same day";
  }

  const ageDays = Math.floor(ageHours / 24);
  return ageDays <= 1 ? "1 day old" : `${ageDays} days old`;
}

function sanitizeDecimalInput(previous: string, next: string): string {
  const trimmed = next.trim();
  if (trimmed === "") {
    return "";
  }

  if (!DECIMAL_INPUT_PATTERN.test(trimmed)) {
    return previous;
  }

  return trimmed;
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

function readApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return error.message || fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function WIPProductionPage({ isAdmin }: WIPProductionPageProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("molding");

  const [moldingForm, setMoldingForm] = useState<MoldingFormState>({
    item_id: "",
    source_batch_id: "",
    input_weight: "",
    molded_output: "",
    scrap_qty: "0",
    shortlength_qty: "0",
    process_loss_qty: "0",
    diameter: "",
    note: "",
    sku_query: "",
    entry_date: todayISODate(),
  });

  const [polishingForm, setPolishingForm] = useState<PolishingFormState>({
    item_id: "",
    source_batch_id: "",
    molded_input: "",
    finished_output: "",
    polishing_scrap_qty: "0",
    polishing_shortlength_qty: "0",
    final_adjustment_qty: "0",
    note: "",
    sku_query: "",
    entry_date: todayISODate(),
  });

  const [submittingStage, setSubmittingStage] = useState<WIPStage | null>(null);

  const [actingJournalID, setActingJournalID] = useState<string | null>(null);

  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalDialogStage, setApprovalDialogStage] =
    useState<WIPStage | null>(null);
  const [approvalDialogNote, setApprovalDialogNote] = useState("");

  const [diameterByItemID, setDiameterByItemID] = useState<
    Record<string, string>
  >({});
  const warnedEntryDateRef = useRef<Record<string, string>>({});

  const moldingItemsQuery = useQuery({
    queryKey: wipKeys.selectableItems("molding"),
    queryFn: () => getWIPSelectableItems("molding"),
  });

  const polishingItemsQuery = useQuery({
    queryKey: wipKeys.selectableItems("polishing"),
    queryFn: () => getWIPSelectableItems("polishing"),
  });

  const moldingLotsQuery = useQuery({
    queryKey: wipKeys.lots("molding", moldingForm.item_id),
    queryFn: () => getWIPLots(moldingForm.item_id, "molding"),
    enabled: Boolean(moldingForm.item_id.trim()),
  });

  const polishingLotsQuery = useQuery({
    queryKey: wipKeys.lots("polishing", polishingForm.item_id),
    queryFn: () => getWIPLots(polishingForm.item_id, "polishing"),
    enabled: Boolean(polishingForm.item_id.trim()),
  });

  const pendingQuery = useQuery({
    queryKey: wipKeys.pendingApprovals(),
    queryFn: getPendingApprovals,
    enabled: isAdmin && activeTab === "pending",
  });

  const submitMoldingMutation = useMutation({ mutationFn: submitMolding });
  const submitPolishingMutation = useMutation({ mutationFn: submitPolishing });
  const approveMutation = useMutation({
    mutationFn: (journalID: string) => approvePendingApproval(journalID),
  });
  const rejectMutation = useMutation({
    mutationFn: (journalID: string) => rejectPendingApproval(journalID),
  });

  const moldingItems: WIPSelectableItem[] = moldingItemsQuery.data ?? [];
  const polishingItems: WIPSelectableItem[] = polishingItemsQuery.data ?? [];
  const moldingLots: WIPLotOption[] = moldingLotsQuery.data ?? [];
  const polishingLots: WIPLotOption[] = polishingLotsQuery.data ?? [];
  const pendingRows: PendingWIPApproval[] = pendingQuery.data ?? [];

  const loadingMoldingItems = moldingItemsQuery.isFetching;
  const loadingPolishingItems = polishingItemsQuery.isFetching;
  const loadingMoldingLots = moldingLotsQuery.isFetching;
  const loadingPolishingLots = polishingLotsQuery.isFetching;
  const loadingPendingRows = pendingQuery.isFetching;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const cached = parseDiameterCache(
      window.localStorage.getItem(DIAMETER_CACHE_KEY),
    );
    setDiameterByItemID(cached);
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

  useEffect(() => {
    if (moldingItemsQuery.error) {
      toast.error(
        readApiErrorMessage(
          moldingItemsQuery.error,
          "Failed to load molding SKU options.",
        ),
      );
    }
  }, [moldingItemsQuery.error]);

  useEffect(() => {
    if (polishingItemsQuery.error) {
      toast.error(
        readApiErrorMessage(
          polishingItemsQuery.error,
          "Failed to load polishing SKU options.",
        ),
      );
    }
  }, [polishingItemsQuery.error]);

  useEffect(() => {
    if (moldingLotsQuery.error) {
      toast.error(
        readApiErrorMessage(
          moldingLotsQuery.error,
          "Failed to load molding LOT options.",
        ),
      );
    }
  }, [moldingLotsQuery.error]);

  useEffect(() => {
    if (polishingLotsQuery.error) {
      toast.error(
        readApiErrorMessage(
          polishingLotsQuery.error,
          "Failed to load polishing LOT options.",
        ),
      );
    }
  }, [polishingLotsQuery.error]);

  useEffect(() => {
    if (pendingQuery.error) {
      toast.error(
        readApiErrorMessage(
          pendingQuery.error,
          "Failed to load pending approvals.",
        ),
      );
    }
  }, [pendingQuery.error]);

  const filteredMoldingItems = useMemo(() => {
    const query = moldingForm.sku_query.trim().toLowerCase();
    if (!query) {
      return moldingItems;
    }

    return moldingItems.filter((item) =>
      item.label.toLowerCase().includes(query),
    );
  }, [moldingItems, moldingForm.sku_query]);

  const filteredPolishingItems = useMemo(() => {
    const query = polishingForm.sku_query.trim().toLowerCase();
    if (!query) {
      return polishingItems;
    }

    return polishingItems.filter((item) =>
      item.label.toLowerCase().includes(query),
    );
  }, [polishingItems, polishingForm.sku_query]);

  const selectedMoldingLot = useMemo(
    () =>
      moldingLots.find((lot) => lot.batch_id === moldingForm.source_batch_id),
    [moldingLots, moldingForm.source_batch_id],
  );

  const selectedPolishingLot = useMemo(
    () =>
      polishingLots.find(
        (lot) => lot.batch_id === polishingForm.source_batch_id,
      ),
    [polishingLots, polishingForm.source_batch_id],
  );

  const moldingMassBalance = useMemo(
    () =>
      calculateMassBalance(
        moldingForm.input_weight,
        moldingForm.molded_output,
        moldingForm.scrap_qty,
        moldingForm.shortlength_qty,
        moldingForm.process_loss_qty,
      ),
    [
      moldingForm.input_weight,
      moldingForm.molded_output,
      moldingForm.scrap_qty,
      moldingForm.shortlength_qty,
      moldingForm.process_loss_qty,
    ],
  );

  const polishingMassBalance = useMemo(
    () =>
      calculateMassBalance(
        polishingForm.molded_input,
        polishingForm.finished_output,
        polishingForm.polishing_scrap_qty,
        polishingForm.polishing_shortlength_qty,
        polishingForm.final_adjustment_qty,
      ),
    [
      polishingForm.molded_input,
      polishingForm.finished_output,
      polishingForm.polishing_scrap_qty,
      polishingForm.polishing_shortlength_qty,
      polishingForm.final_adjustment_qty,
    ],
  );

  const moldingInputError = useMemo(() => {
    const entered = toNumber(moldingForm.input_weight);
    const available = selectedMoldingLot?.remaining_weight ?? 0;

    if (!moldingForm.input_weight.trim()) {
      return "Input weight is required.";
    }

    if (entered <= 0) {
      return "Input weight must be greater than 0.";
    }

    if (selectedMoldingLot && entered > available) {
      return "Input exceeds available LOT quantity.";
    }

    return "";
  }, [moldingForm.input_weight, selectedMoldingLot]);

  const polishingInputError = useMemo(() => {
    const entered = toNumber(polishingForm.molded_input);
    const available = selectedPolishingLot?.remaining_weight ?? 0;

    if (!polishingForm.molded_input.trim()) {
      return "Molded input is required.";
    }

    if (entered <= 0) {
      return "Molded input must be greater than 0.";
    }

    if (selectedPolishingLot && entered > available) {
      return "Input exceeds available LOT quantity.";
    }

    return "";
  }, [polishingForm.molded_input, selectedPolishingLot]);

  const moldingCanSubmit =
    Boolean(moldingForm.item_id) &&
    Boolean(moldingForm.source_batch_id) &&
    Boolean(moldingForm.molded_output.trim()) &&
    Boolean(moldingForm.diameter.trim()) &&
    !moldingInputError;

  const polishingCanSubmit =
    Boolean(polishingForm.item_id) &&
    Boolean(polishingForm.source_batch_id) &&
    Boolean(polishingForm.finished_output.trim()) &&
    !polishingInputError;

  const checkEntryDateWarning = useCallback(
    (stage: WIPStage, entryDate: string) => {
      if (!entryDate) {
        return;
      }

      const ageHours =
        (Date.now() - new Date(`${entryDate}T00:00:00`).getTime()) /
        (1000 * 60 * 60);
      if (ageHours <= 24) {
        return;
      }

      const lastWarned = warnedEntryDateRef.current[stage];
      if (lastWarned === entryDate) {
        return;
      }

      warnedEntryDateRef.current[stage] = entryDate;
      toast.warning(
        `Late entry (${ageLabelForDate(entryDate)}). Ensure weights are accurate.`,
      );
    },
    [],
  );

  const submitStage = useCallback(
    async (
      stage: WIPStage,
      forceApprovalRequest: boolean,
      forcedNote?: string,
    ) => {
      if (submittingStage) {
        return;
      }

      if (stage === "molding") {
        if (!moldingCanSubmit) {
          toast.error("Complete required molding fields before submitting.");
          return;
        }

        if (!moldingMassBalance.withinTolerance && !forceApprovalRequest) {
          toast.error("Difference exceeds tolerance. Use Request Approval.");
          return;
        }

        const note = (forcedNote ?? moldingForm.note).trim();
        if (!moldingMassBalance.withinTolerance && !note) {
          toast.error("Reason for discrepancy is required.");
          return;
        }

        const payload: MoldingPayload = {
          source_batch_id: moldingForm.source_batch_id,
          input_weight: moldingForm.input_weight,
          molded_output: moldingForm.molded_output,
          scrap_qty: moldingForm.scrap_qty || "0",
          shortlength_qty: moldingForm.shortlength_qty || "0",
          process_loss_qty: moldingForm.process_loss_qty || "0",
          diameter: moldingForm.diameter,
          note,
        };

        setSubmittingStage("molding");
        try {
          const result = await submitMoldingMutation.mutateAsync(payload);
          const detail = `Diff ${result.difference} kg | Allowed ${result.tolerance} kg`;

          if (
            result.requires_approval ||
            result.status === "PENDING_APPROVAL"
          ) {
            toast.success("Sent for approval. Stock reserved.", {
              description: detail,
            });
          } else {
            toast.success("Molding submitted.", { description: detail });
          }

          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: wipKeys.lots("molding", moldingForm.item_id),
            }),
            queryClient.invalidateQueries({
              queryKey: inventoryKeys.snapshot(),
            }),
            isAdmin && activeTab === "pending"
              ? queryClient.invalidateQueries({
                  queryKey: wipKeys.pendingApprovals(),
                })
              : Promise.resolve(),
          ]);
        } catch (error) {
          toast.error(readApiErrorMessage(error, "Failed to submit molding."));
        } finally {
          setSubmittingStage(null);
          setApprovalDialogOpen(false);
          setApprovalDialogStage(null);
        }

        return;
      }

      if (!polishingCanSubmit) {
        toast.error("Complete required polishing fields before submitting.");
        return;
      }

      if (!polishingMassBalance.withinTolerance && !forceApprovalRequest) {
        toast.error("Difference exceeds tolerance. Use Request Approval.");
        return;
      }

      const note = (forcedNote ?? polishingForm.note).trim();
      if (!polishingMassBalance.withinTolerance && !note) {
        toast.error("Reason for discrepancy is required.");
        return;
      }

      const payload: PolishingPayload = {
        source_batch_id: polishingForm.source_batch_id,
        molded_input: polishingForm.molded_input,
        finished_output: polishingForm.finished_output,
        polishing_scrap_qty: polishingForm.polishing_scrap_qty || "0",
        polishing_shortlength_qty:
          polishingForm.polishing_shortlength_qty || "0",
        final_adjustment_qty: polishingForm.final_adjustment_qty || "0",
        note,
      };

      setSubmittingStage("polishing");
      try {
        const result = await submitPolishingMutation.mutateAsync(payload);
        const detail = `Diff ${result.difference} kg | Allowed ${result.tolerance} kg`;

        if (result.requires_approval || result.status === "PENDING_APPROVAL") {
          toast.success("Sent for approval. Stock reserved.", {
            description: detail,
          });
        } else {
          toast.success("Polishing submitted.", { description: detail });
        }

        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: wipKeys.lots("polishing", polishingForm.item_id),
          }),
          queryClient.invalidateQueries({
            queryKey: inventoryKeys.snapshot(),
          }),
          isAdmin && activeTab === "pending"
            ? queryClient.invalidateQueries({
                queryKey: wipKeys.pendingApprovals(),
              })
            : Promise.resolve(),
        ]);
      } catch (error) {
        toast.error(readApiErrorMessage(error, "Failed to submit polishing."));
      } finally {
        setSubmittingStage(null);
        setApprovalDialogOpen(false);
        setApprovalDialogStage(null);
      }
    },
    [
      activeTab,
      isAdmin,
      moldingCanSubmit,
      moldingForm,
      moldingMassBalance.withinTolerance,
      polishingCanSubmit,
      polishingForm,
      polishingMassBalance.withinTolerance,
      queryClient,
      submitMoldingMutation,
      submitPolishingMutation,
      submittingStage,
    ],
  );

  const openRequestApprovalDialog = useCallback(
    (stage: WIPStage) => {
      setApprovalDialogStage(stage);
      if (stage === "molding") {
        setApprovalDialogNote(moldingForm.note);
      } else {
        setApprovalDialogNote(polishingForm.note);
      }
      setApprovalDialogOpen(true);
    },
    [moldingForm.note, polishingForm.note],
  );

  const applyApprovalDialogNote = useCallback(() => {
    if (!approvalDialogStage) {
      return;
    }

    const note = approvalDialogNote.trim();
    if (!note) {
      toast.error("Reason for discrepancy is required.");
      return;
    }

    if (approvalDialogStage === "molding") {
      setMoldingForm((previous) => ({ ...previous, note }));
    } else {
      setPolishingForm((previous) => ({ ...previous, note }));
    }

    void submitStage(approvalDialogStage, true, note);
  }, [approvalDialogNote, approvalDialogStage, submitStage]);

  const historyLink = useCallback(
    (entryDate: string, lotCode: string): string => {
      const params = new URLSearchParams();
      if (entryDate) {
        params.set("date", entryDate);
      }
      if (lotCode) {
        params.set("lot", lotCode);
      }

      return `/reports/production?${params.toString()}`;
    },
    [],
  );

  const actOnPending = useCallback(
    async (journalID: string, action: "approve" | "reject") => {
      setActingJournalID(journalID);
      try {
        if (action === "approve") {
          await approveMutation.mutateAsync(journalID);
          toast.success("Pending approval approved.");
        } else {
          await rejectMutation.mutateAsync(journalID);
          toast.success("Pending approval rejected.");
        }

        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: wipKeys.pendingApprovals(),
          }),
          queryClient.invalidateQueries({ queryKey: inventoryKeys.snapshot() }),
        ]);
      } catch (error) {
        toast.error(readApiErrorMessage(error, `Failed to ${action} journal.`));
      } finally {
        setActingJournalID(null);
      }
    },
    [approveMutation, queryClient, rejectMutation],
  );

  return (
    <div className="space-y-6 erp-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="erp-section-title">Inventory Workbench</p>
          <h1 className="text-2xl font-bold text-foreground">
            WIP Production Ledger
          </h1>
          <p className="text-sm text-muted-foreground">
            Submit molding and polishing journals with live mass-balance
            guardrails.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start" variant="line">
          <TabsTrigger value="molding">Molding</TabsTrigger>
          <TabsTrigger value="polishing">Polishing</TabsTrigger>
          {isAdmin ? (
            <TabsTrigger value="pending">Pending Approvals</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="molding" className="pt-2">
          <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
            <Card className="erp-card-static bg-card">
              <CardHeader>
                <CardTitle>Molding Entry</CardTitle>
                <CardDescription>
                  RAW LOT consumption into MOLDED output with discrepancy
                  escalation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="molding-sku-search">Search SKU</Label>
                    <Input
                      id="molding-sku-search"
                      value={moldingForm.sku_query}
                      onChange={(event) =>
                        setMoldingForm((previous) => ({
                          ...previous,
                          sku_query: event.target.value,
                        }))
                      }
                      placeholder="Type SKU or item name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="molding-entry-date">Entry Date</Label>
                    <Input
                      id="molding-entry-date"
                      type="date"
                      value={moldingForm.entry_date}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setMoldingForm((previous) => ({
                          ...previous,
                          entry_date: nextValue,
                        }));
                        checkEntryDateWarning("molding", nextValue);
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <Select
                      value={moldingForm.item_id}
                      onValueChange={(value) => {
                        const nextItemID = value ?? "";
                        setMoldingForm((previous) => ({
                          ...previous,
                          item_id: nextItemID,
                          source_batch_id: "",
                          diameter:
                            previous.diameter ||
                            diameterByItemID[nextItemID] ||
                            "",
                        }));
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={
                            loadingMoldingItems
                              ? "Loading SKU..."
                              : "Select RAW SKU"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredMoldingItems.map((item) => (
                          <SelectItem key={item.item_id} value={item.item_id}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>LOT</Label>
                    <Select
                      value={moldingForm.source_batch_id}
                      onValueChange={(value) =>
                        setMoldingForm((previous) => ({
                          ...previous,
                          source_batch_id: value ?? "",
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={
                            loadingMoldingLots
                              ? "Loading LOT..."
                              : "Select LOT for molding"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {moldingLots.map((lot) => (
                          <SelectItem key={lot.batch_id} value={lot.batch_id}>
                            {`${lot.batch_code} | Available ${toFourDecimal(lot.remaining_weight)} kg`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="molding-input-weight">
                      Input Weight (kg)
                    </Label>
                    <Input
                      id="molding-input-weight"
                      value={moldingForm.input_weight}
                      inputMode="decimal"
                      onChange={(event) =>
                        setMoldingForm((previous) => ({
                          ...previous,
                          input_weight: sanitizeDecimalInput(
                            previous.input_weight,
                            event.target.value,
                          ),
                        }))
                      }
                      placeholder="0.0000"
                    />
                    {moldingInputError ? (
                      <p className="text-xs text-destructive">
                        {moldingInputError}
                      </p>
                    ) : null}
                    {selectedMoldingLot && moldingForm.input_weight ? (
                      <p className="text-xs text-muted-foreground">
                        Remaining after entry:{" "}
                        {toFourDecimal(
                          Math.max(
                            selectedMoldingLot.remaining_weight -
                              toNumber(moldingForm.input_weight),
                            0,
                          ),
                        )}{" "}
                        kg
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="molding-output">Molded Output (kg)</Label>
                    <Input
                      id="molding-output"
                      value={moldingForm.molded_output}
                      inputMode="decimal"
                      onChange={(event) =>
                        setMoldingForm((previous) => ({
                          ...previous,
                          molded_output: sanitizeDecimalInput(
                            previous.molded_output,
                            event.target.value,
                          ),
                        }))
                      }
                      placeholder="0.0000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="molding-scrap">Scrap (kg)</Label>
                    <Input
                      id="molding-scrap"
                      value={moldingForm.scrap_qty}
                      inputMode="decimal"
                      onChange={(event) =>
                        setMoldingForm((previous) => ({
                          ...previous,
                          scrap_qty: sanitizeDecimalInput(
                            previous.scrap_qty,
                            event.target.value,
                          ),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="molding-shortlength">
                      Shortlength (kg)
                    </Label>
                    <Input
                      id="molding-shortlength"
                      value={moldingForm.shortlength_qty}
                      inputMode="decimal"
                      onChange={(event) =>
                        setMoldingForm((previous) => ({
                          ...previous,
                          shortlength_qty: sanitizeDecimalInput(
                            previous.shortlength_qty,
                            event.target.value,
                          ),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="molding-process-loss">
                      Process Loss (kg)
                    </Label>
                    <Input
                      id="molding-process-loss"
                      value={moldingForm.process_loss_qty}
                      inputMode="decimal"
                      onChange={(event) =>
                        setMoldingForm((previous) => ({
                          ...previous,
                          process_loss_qty: sanitizeDecimalInput(
                            previous.process_loss_qty,
                            event.target.value,
                          ),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="molding-diameter">Diameter (mm)</Label>
                    <Input
                      id="molding-diameter"
                      value={moldingForm.diameter}
                      inputMode="decimal"
                      onChange={(event) => {
                        const nextDiameter = sanitizeDecimalInput(
                          moldingForm.diameter,
                          event.target.value,
                        );

                        setMoldingForm((previous) => ({
                          ...previous,
                          diameter: nextDiameter,
                        }));
                        if (moldingForm.item_id) {
                          setDiameterByItemID((previous) => ({
                            ...previous,
                            [moldingForm.item_id]: nextDiameter,
                          }));
                        }
                      }}
                      placeholder="0.0000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="molding-note">Note</Label>
                  <Textarea
                    id="molding-note"
                    value={moldingForm.note}
                    onChange={(event) =>
                      setMoldingForm((previous) => ({
                        ...previous,
                        note: event.target.value,
                      }))
                    }
                    placeholder="Add context for operators or discrepancies"
                    maxLength={500}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                  <Button
                    disabled={
                      submittingStage === "molding" ||
                      !moldingCanSubmit ||
                      !moldingMassBalance.withinTolerance
                    }
                    onClick={() => void submitStage("molding", false)}
                  >
                    {submittingStage === "molding" ? "Submitting..." : "Submit"}
                  </Button>

                  {!moldingMassBalance.withinTolerance && moldingCanSubmit ? (
                    <Button
                      variant="secondary"
                      disabled={submittingStage === "molding"}
                      onClick={() => openRequestApprovalDialog("molding")}
                    >
                      Request Approval
                    </Button>
                  ) : null}

                  {!moldingMassBalance.withinTolerance ? (
                    <p className="text-xs text-amber-400">
                      Difference exceeds tolerance. Submit is disabled until
                      approval request.
                    </p>
                  ) : null}

                  <div className="ml-auto">
                    <Link
                      href={historyLink(
                        moldingForm.entry_date,
                        selectedMoldingLot?.batch_code ?? "",
                      )}
                      className="text-xs font-medium text-primary hover:text-primary/80"
                    >
                      View History
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="erp-card-static bg-card">
              <CardHeader>
                <CardTitle>Live Math Panel</CardTitle>
                <CardDescription>
                  Estimated guardrail preview. Backend response remains the
                  source of truth.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Input Weight</p>
                  <p className="text-lg font-semibold">
                    {toFourDecimal(moldingMassBalance.input)} kg
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Expected Total
                  </p>
                  <p className="text-lg font-semibold">
                    {toFourDecimal(moldingMassBalance.expectedTotal)} kg
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Difference</p>
                  <p className="text-lg font-semibold">
                    {toFourDecimal(moldingMassBalance.difference)} kg
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Tolerance (Estimated)
                  </p>
                  <p className="text-lg font-semibold">
                    {toFourDecimal(moldingMassBalance.toleranceEstimate)} kg
                  </p>
                </div>
                <div
                  className={`rounded-lg border p-3 ${
                    moldingMassBalance.withinTolerance
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-amber-500/40 bg-amber-500/10"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {moldingMassBalance.withinTolerance ? (
                      <CheckCircle2 className="size-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="size-4 text-amber-400" />
                    )}
                    {moldingMassBalance.withinTolerance
                      ? "Mass balance is within tolerance"
                      : "Difference exceeds tolerance"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="polishing" className="pt-2">
          <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
            <Card className="erp-card-static bg-card">
              <CardHeader>
                <CardTitle>Polishing Entry</CardTitle>
                <CardDescription>
                  MOLDED LOT consumption into FINISHED output with discrepancy
                  escalation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="polishing-sku-search">Search SKU</Label>
                    <Input
                      id="polishing-sku-search"
                      value={polishingForm.sku_query}
                      onChange={(event) =>
                        setPolishingForm((previous) => ({
                          ...previous,
                          sku_query: event.target.value,
                        }))
                      }
                      placeholder="Type SKU or item name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="polishing-entry-date">Entry Date</Label>
                    <Input
                      id="polishing-entry-date"
                      type="date"
                      value={polishingForm.entry_date}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setPolishingForm((previous) => ({
                          ...previous,
                          entry_date: nextValue,
                        }));
                        checkEntryDateWarning("polishing", nextValue);
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <Select
                      value={polishingForm.item_id}
                      onValueChange={(value) => {
                        const nextItemID = value ?? "";
                        setPolishingForm((previous) => ({
                          ...previous,
                          item_id: nextItemID,
                          source_batch_id: "",
                        }));
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={
                            loadingPolishingItems
                              ? "Loading SKU..."
                              : "Select MOLDED SKU"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredPolishingItems.map((item) => (
                          <SelectItem key={item.item_id} value={item.item_id}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>LOT</Label>
                    <Select
                      value={polishingForm.source_batch_id}
                      onValueChange={(value) =>
                        setPolishingForm((previous) => ({
                          ...previous,
                          source_batch_id: value ?? "",
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={
                            loadingPolishingLots
                              ? "Loading LOT..."
                              : "Select LOT for polishing"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {polishingLots.map((lot) => (
                          <SelectItem key={lot.batch_id} value={lot.batch_id}>
                            {`${lot.batch_code} | Available ${toFourDecimal(lot.remaining_weight)} kg`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="polishing-input">Molded Input (kg)</Label>
                    <Input
                      id="polishing-input"
                      value={polishingForm.molded_input}
                      inputMode="decimal"
                      onChange={(event) =>
                        setPolishingForm((previous) => ({
                          ...previous,
                          molded_input: sanitizeDecimalInput(
                            previous.molded_input,
                            event.target.value,
                          ),
                        }))
                      }
                      placeholder="0.0000"
                    />
                    {polishingInputError ? (
                      <p className="text-xs text-destructive">
                        {polishingInputError}
                      </p>
                    ) : null}
                    {selectedPolishingLot && polishingForm.molded_input ? (
                      <p className="text-xs text-muted-foreground">
                        Remaining after entry:{" "}
                        {toFourDecimal(
                          Math.max(
                            selectedPolishingLot.remaining_weight -
                              toNumber(polishingForm.molded_input),
                            0,
                          ),
                        )}{" "}
                        kg
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="polishing-output">
                      Finished Output (kg)
                    </Label>
                    <Input
                      id="polishing-output"
                      value={polishingForm.finished_output}
                      inputMode="decimal"
                      onChange={(event) =>
                        setPolishingForm((previous) => ({
                          ...previous,
                          finished_output: sanitizeDecimalInput(
                            previous.finished_output,
                            event.target.value,
                          ),
                        }))
                      }
                      placeholder="0.0000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="polishing-scrap">
                      Polishing Scrap (kg)
                    </Label>
                    <Input
                      id="polishing-scrap"
                      value={polishingForm.polishing_scrap_qty}
                      inputMode="decimal"
                      onChange={(event) =>
                        setPolishingForm((previous) => ({
                          ...previous,
                          polishing_scrap_qty: sanitizeDecimalInput(
                            previous.polishing_scrap_qty,
                            event.target.value,
                          ),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="polishing-shortlength">
                      Polishing Shortlength (kg)
                    </Label>
                    <Input
                      id="polishing-shortlength"
                      value={polishingForm.polishing_shortlength_qty}
                      inputMode="decimal"
                      onChange={(event) =>
                        setPolishingForm((previous) => ({
                          ...previous,
                          polishing_shortlength_qty: sanitizeDecimalInput(
                            previous.polishing_shortlength_qty,
                            event.target.value,
                          ),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="polishing-adjustment">
                      Final Adjustment (kg)
                    </Label>
                    <Input
                      id="polishing-adjustment"
                      value={polishingForm.final_adjustment_qty}
                      inputMode="decimal"
                      onChange={(event) =>
                        setPolishingForm((previous) => ({
                          ...previous,
                          final_adjustment_qty: sanitizeDecimalInput(
                            previous.final_adjustment_qty,
                            event.target.value,
                          ),
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="polishing-note">Note</Label>
                  <Textarea
                    id="polishing-note"
                    value={polishingForm.note}
                    onChange={(event) =>
                      setPolishingForm((previous) => ({
                        ...previous,
                        note: event.target.value,
                      }))
                    }
                    placeholder="Add context for operators or discrepancies"
                    maxLength={500}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                  <Button
                    disabled={
                      submittingStage === "polishing" ||
                      !polishingCanSubmit ||
                      !polishingMassBalance.withinTolerance
                    }
                    onClick={() => void submitStage("polishing", false)}
                  >
                    {submittingStage === "polishing"
                      ? "Submitting..."
                      : "Submit"}
                  </Button>

                  {!polishingMassBalance.withinTolerance &&
                  polishingCanSubmit ? (
                    <Button
                      variant="secondary"
                      disabled={submittingStage === "polishing"}
                      onClick={() => openRequestApprovalDialog("polishing")}
                    >
                      Request Approval
                    </Button>
                  ) : null}

                  {!polishingMassBalance.withinTolerance ? (
                    <p className="text-xs text-amber-400">
                      Difference exceeds tolerance. Submit is disabled until
                      approval request.
                    </p>
                  ) : null}

                  <div className="ml-auto">
                    <Link
                      href={historyLink(
                        polishingForm.entry_date,
                        selectedPolishingLot?.batch_code ?? "",
                      )}
                      className="text-xs font-medium text-primary hover:text-primary/80"
                    >
                      View History
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="erp-card-static bg-card">
              <CardHeader>
                <CardTitle>Live Math Panel</CardTitle>
                <CardDescription>
                  Estimated guardrail preview. Backend response remains the
                  source of truth.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Molded Input</p>
                  <p className="text-lg font-semibold">
                    {toFourDecimal(polishingMassBalance.input)} kg
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Expected Total
                  </p>
                  <p className="text-lg font-semibold">
                    {toFourDecimal(polishingMassBalance.expectedTotal)} kg
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Difference</p>
                  <p className="text-lg font-semibold">
                    {toFourDecimal(polishingMassBalance.difference)} kg
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Tolerance (Estimated)
                  </p>
                  <p className="text-lg font-semibold">
                    {toFourDecimal(polishingMassBalance.toleranceEstimate)} kg
                  </p>
                </div>
                <div
                  className={`rounded-lg border p-3 ${
                    polishingMassBalance.withinTolerance
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-amber-500/40 bg-amber-500/10"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {polishingMassBalance.withinTolerance ? (
                      <CheckCircle2 className="size-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="size-4 text-amber-400" />
                    )}
                    {polishingMassBalance.withinTolerance
                      ? "Mass balance is within tolerance"
                      : "Difference exceeds tolerance"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {isAdmin ? (
          <TabsContent value="pending" className="pt-2">
            <Card className="erp-card-static bg-card">
              <CardHeader>
                <CardTitle>Pending Approvals</CardTitle>
                <CardDescription>
                  Review discrepancy notes and resolve blocked production
                  journals.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingPendingRows}
                    onClick={() => void pendingQuery.refetch()}
                  >
                    <RefreshCcw className="mr-1 size-3.5" />
                    Refresh
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source LOT</TableHead>
                      <TableHead>Input (kg)</TableHead>
                      <TableHead>Expected (kg)</TableHead>
                      <TableHead>Difference (kg)</TableHead>
                      <TableHead>Tolerance (kg)</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRows.map((row) => (
                      <TableRow key={row.journal_id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">
                              {row.source_batch_code}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {row.source_batch_type}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{row.input_weight}</TableCell>
                        <TableCell>{row.expected_total}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{row.difference}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.tolerance}</Badge>
                        </TableCell>
                        <TableCell className="max-w-64 whitespace-normal text-xs text-muted-foreground">
                          {row.note || "No note"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={actingJournalID === row.journal_id}
                              onClick={() =>
                                void actOnPending(row.journal_id, "approve")
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={actingJournalID === row.journal_id}
                              onClick={() =>
                                void actOnPending(row.journal_id, "reject")
                              }
                            >
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}

                    {!loadingPendingRows && pendingRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-sm text-muted-foreground"
                        >
                          No pending approvals.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>

      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reason for Discrepancy</DialogTitle>
            <DialogDescription>
              Difference exceeds tolerance. Add a clear reason before requesting
              admin approval.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="approval-note">Reason</Label>
            <Textarea
              id="approval-note"
              value={approvalDialogNote}
              onChange={(event) => setApprovalDialogNote(event.target.value)}
              placeholder="Example: Bad coil quality, scale drift observed"
              maxLength={500}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApprovalDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={applyApprovalDialogNote}>Request Approval</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
