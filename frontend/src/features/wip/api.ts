import { apiClient } from "@/lib/api-client";
import {
  moldingPayloadSchema,
  pendingApprovalListSchema,
  pendingNoteSchema,
  polishingPayloadSchema,
  wipActivityEntryListSchema,
} from "@/features/wip/schemas";
import type {
  MoldingPayload,
  PendingWIPApproval,
  PolishingPayload,
  WIPActivityEntry,
  WIPLotOption,
  WIPSelectableItem,
  WIPStage,
  WIPSubmissionResult,
} from "@/features/wip/types";

type SelectableItemsResponse = { items?: unknown };
type BatchesResponse = { batches?: unknown };
type PendingApprovalsResponse = { rows?: unknown };
type WIPActivityEntriesResponse = { rows?: unknown };

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function sanitizeSelectableItems(value: unknown): WIPSelectableItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (row): row is { item_id: string; label: string; category: string } =>
        Boolean(row) &&
        typeof row === "object" &&
        typeof (row as { item_id?: unknown }).item_id === "string" &&
        typeof (row as { label?: unknown }).label === "string" &&
        typeof (row as { category?: unknown }).category === "string",
    )
    .map((row) => ({
      item_id: row.item_id,
      label: row.label,
      category:
        row.category === "RAW" || row.category === "SEMI_FINISHED"
          ? row.category
          : "RAW",
    }));
}

function sanitizeBatches(value: unknown): WIPLotOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (
        row,
      ): row is {
        id?: string;
        batch_id: string;
        batch_code: string;
        sku?: string;
        remaining_qty?: number;
        arrival_date: string;
        initial_weight: number;
        remaining_weight: number;
        status: string;
      } =>
        Boolean(row) &&
        typeof row === "object" &&
        typeof (row as { batch_id?: unknown }).batch_id === "string" &&
        typeof (row as { batch_code?: unknown }).batch_code === "string",
    )
    .map((row) => ({
      id: typeof row.id === "string" ? row.id : row.batch_id,
      batch_id: row.batch_id,
      batch_code: row.batch_code,
      sku: typeof row.sku === "string" ? row.sku.trim() : "",
      remaining_qty: toNumber(row.remaining_qty),
      arrival_date:
        typeof row.arrival_date === "string" ? row.arrival_date : "",
      initial_weight: toNumber(row.initial_weight),
      remaining_weight: toNumber(row.remaining_weight),
      status: typeof row.status === "string" ? row.status : "ACTIVE",
    }));
}

export async function getWIPSelectableItems(
  stage: WIPStage,
): Promise<WIPSelectableItem[]> {
  const data = await apiClient<SelectableItemsResponse>("/items/selectable", {
    method: "GET",
  });

  const allItems = sanitizeSelectableItems(data.items);

  if (stage === "molding") {
    return allItems
      .filter((item) => item.category === "RAW")
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  // Polishing queue is selected directly from active MOLDED batches.
  return [];
}

export async function getWIPLots(
  itemID: string,
  stage: WIPStage,
): Promise<WIPLotOption[]> {
  const batchType = stage === "molding" ? "RAW" : "MOLDED";
  const params = new URLSearchParams({ type: batchType });
  const trimmedItemID = itemID.trim();
  if (trimmedItemID) {
    params.set("item_id", trimmedItemID);
  }
  const data = await apiClient<BatchesResponse>(
    `/inventory/batches?${params.toString()}`,
    {
      method: "GET",
    },
  );

  return sanitizeBatches(data.batches).sort((a, b) =>
    b.arrival_date.localeCompare(a.arrival_date),
  );
}

export async function submitMolding(
  payload: MoldingPayload,
): Promise<WIPSubmissionResult> {
  const parsed = moldingPayloadSchema.parse(payload);

  return apiClient<WIPSubmissionResult>("/production/molding", {
    method: "POST",
    headers: {
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(parsed),
  });
}

export async function submitPolishing(
  payload: PolishingPayload,
): Promise<WIPSubmissionResult> {
  const parsed = polishingPayloadSchema.parse(payload);

  return apiClient<WIPSubmissionResult>("/production/polishing", {
    method: "POST",
    headers: {
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(parsed),
  });
}

export async function getPendingApprovals(): Promise<PendingWIPApproval[]> {
  const data = await apiClient<PendingApprovalsResponse>(
    "/production/pending",
    {
      method: "GET",
    },
  );

  const parsed = pendingApprovalListSchema.safeParse(data.rows);
  return parsed.success ? parsed.data : [];
}

export async function getWIPActivityEntries(params: {
  from: string;
  to: string;
  limit?: number;
  offset?: number;
}): Promise<WIPActivityEntry[]> {
  const query = new URLSearchParams({
    from: params.from.trim(),
    to: params.to.trim(),
    limit: String(params.limit ?? 100),
    offset: String(params.offset ?? 0),
  });

  const data = await apiClient<WIPActivityEntriesResponse>(
    `/production/entries?${query.toString()}`,
    {
      method: "GET",
    },
  );

  const parsed = wipActivityEntryListSchema.safeParse(data.rows);
  return parsed.success ? parsed.data : [];
}

export async function approvePendingApproval(
  journalID: string,
  note?: string,
): Promise<WIPSubmissionResult> {
  const parsedNote = pendingNoteSchema.parse({ note });

  return apiClient<WIPSubmissionResult>(`/production/approve/${journalID}`, {
    method: "PATCH",
    body: JSON.stringify(parsedNote),
  });
}

export async function rejectPendingApproval(
  journalID: string,
  note?: string,
): Promise<WIPSubmissionResult> {
  const parsedNote = pendingNoteSchema.parse({ note });

  return apiClient<WIPSubmissionResult>(`/production/reject/${journalID}`, {
    method: "PATCH",
    body: JSON.stringify(parsedNote),
  });
}
