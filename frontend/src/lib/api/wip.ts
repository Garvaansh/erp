import { apiClient } from "@/lib/api/api-client";
import type {
  AllocatableStock,
  MoldingRunPayload,
  PolishingRunPayload,
  WIPFinishedGoodOption,
  WIPProductionRun,
  WIPRunResult,
  WIPSelectableItem,
  WIPLotOption,
  WIPActivityEntry,
  WIPSubmissionResult,
} from "@/app/(dashboard)/production/wip/types";

// ─── Internal response shapes (BFF envelope data) ────────────────────────────

type RunsResponse = { runs: WIPProductionRun[] };
type ItemsResponse = { items: Array<Record<string, unknown>> };
type AllocatableResponse = AllocatableStock;

// ─── Finished goods item list ─────────────────────────────────────────────────

/**
 * Fetches FINISHED items for the product selector dropdown.
 * Returns only the fields operators need — no internal IDs in labels.
 */
export async function getFinishedGoodOptions(): Promise<WIPFinishedGoodOption[]> {
  const data = await apiClient<ItemsResponse>("/items?category=FINISHED&limit=200", {
    method: "GET",
  });

  if (!Array.isArray(data.items)) return [];

  return data.items
    .filter(
      (row) =>
        typeof row.id === "string" &&
        row.id.trim() !== "" &&
        row.is_active !== false,
    )
    .map((row) => ({
      id: row.id as string,
      sku: typeof row.sku === "string" && row.sku.trim() ? row.sku.trim() : "—",
      name: typeof row.name === "string" ? row.name.trim() : "",
      linked_raw_material_id:
        typeof row.linked_raw_material_id === "string"
          ? row.linked_raw_material_id.trim()
          : undefined,
    }))
    .sort((a, b) => a.sku.localeCompare(b.sku));
}

// ─── Allocatable stock (context cards in dialogs) ────────────────────────────

/**
 * Returns total available qty for a given item + batch type.
 * Used for read-only inventory context cards in the action dialogs.
 * Batch IDs are aggregated on the server — never exposed here.
 */
export async function getAllocatableStock(
  itemId: string,
  batchType: "RAW" | "MOLDED",
): Promise<AllocatableStock | null> {
  const trimmed = itemId.trim();
  if (!trimmed) return null;

  try {
    return await apiClient<AllocatableResponse>(
      `/inventory/allocatable?item_id=${encodeURIComponent(trimmed)}&type=${batchType}`,
      { method: "GET" },
    );
  } catch {
    return null;
  }
}

// ─── Production run ledger ───────────────────────────────────────────────────

/** Fetches paginated WIP production runs for the ledger table. */
export async function getWIPRuns(params?: {
  page?: number;
  page_size?: number;
}): Promise<WIPProductionRun[]> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));

  const query = qs.toString() ? `?${qs.toString()}` : "";
  const data = await apiClient<RunsResponse>(`/wip/runs${query}`, {
    method: "GET",
  });

  return Array.isArray(data.runs) ? data.runs : [];
}

// ─── Production commands ──────────────────────────────────────────────────────

/** Posts a molding run. Returns run result for toast/invalidation. */
export async function submitMoldingRun(
  payload: MoldingRunPayload,
): Promise<WIPRunResult> {
  return apiClient<WIPRunResult>("/wip/molding", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Posts a polishing run. Returns run result for toast/invalidation. */
export async function submitPolishingRun(
  payload: PolishingRunPayload,
): Promise<WIPRunResult> {
  return apiClient<WIPRunResult>("/wip/polishing", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Backward-compat aliases for older WIP API consumers.
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function getWIPSelectableItems(_stage: string): Promise<WIPSelectableItem[]> { return []; }
export async function getWIPLots(_itemId: string, _stage: string): Promise<WIPLotOption[]> { return []; }
export async function getWIPActivityEntries(_params: unknown): Promise<WIPActivityEntry[]> { return []; }
export async function submitMolding(_params: unknown): Promise<WIPSubmissionResult> { return {} as WIPSubmissionResult; }
export async function submitPolishing(_params: unknown): Promise<WIPSubmissionResult> { return {} as WIPSubmissionResult; }
export async function approvePendingApproval(_journalID: string): Promise<void> {}
export async function rejectPendingApproval(_journalID: string): Promise<void> {}
