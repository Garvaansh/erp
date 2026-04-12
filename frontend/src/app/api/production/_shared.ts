import { isRecord, unwrapBackendPayload } from "@/app/api/_shared/http";

export type WIPSubmissionDTO = {
  success: boolean;
  journal_id: string;
  movement_group_id: string;
  status: string;
  requires_approval: boolean;
  difference: string;
  tolerance: string;
  output_batch_id?: string;
};

export type PendingApprovalDTO = {
  journal_id: string;
  movement_group_id: string;
  source_batch_id: string;
  source_batch_code: string;
  source_batch_type: string;
  input_weight: string;
  expected_total: string;
  difference: string;
  tolerance: string;
  note: string;
  created_at: string;
  created_by: string;
};

export type WIPActivityEntryDTO = {
  journal_id: string;
  created_at: string;
  batch_code: string;
  item_sku: string;
  item_name: string;
  workstation: string;
  input_qty: string;
  output_qty: string;
  scrap_qty: string;
  short_qty: string;
  difference: string;
  status: string;
  approval_state: string;
  operator_name: string;
};

function toDecimalString(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || "0.0000";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(4);
  }

  return "0.0000";
}

export function sanitizeWIPSubmission(
  payload: unknown,
): WIPSubmissionDTO | null {
  const raw = unwrapBackendPayload(payload);
  if (!isRecord(raw)) {
    return null;
  }

  if (
    typeof raw.journal_id !== "string" ||
    typeof raw.movement_group_id !== "string" ||
    typeof raw.status !== "string"
  ) {
    return null;
  }

  return {
    success: raw.success === true,
    journal_id: raw.journal_id,
    movement_group_id: raw.movement_group_id,
    status: raw.status,
    requires_approval: raw.requires_approval === true,
    difference: toDecimalString(raw.difference),
    tolerance: toDecimalString(raw.tolerance),
    output_batch_id:
      typeof raw.output_batch_id === "string" ? raw.output_batch_id : undefined,
  };
}

export function sanitizePendingApprovals(
  payload: unknown,
): PendingApprovalDTO[] {
  const raw = unwrapBackendPayload(payload);
  const rows = isRecord(raw) && Array.isArray(raw.rows) ? raw.rows : [];

  return rows
    .filter(
      (row): row is Record<string, unknown> =>
        isRecord(row) &&
        typeof row.journal_id === "string" &&
        typeof row.movement_group_id === "string" &&
        typeof row.source_batch_id === "string" &&
        typeof row.source_batch_code === "string",
    )
    .map((row) => ({
      journal_id: row.journal_id as string,
      movement_group_id: row.movement_group_id as string,
      source_batch_id: row.source_batch_id as string,
      source_batch_code: row.source_batch_code as string,
      source_batch_type:
        typeof row.source_batch_type === "string" ? row.source_batch_type : "",
      input_weight: toDecimalString(row.input_weight),
      expected_total: toDecimalString(row.expected_total),
      difference: toDecimalString(row.difference),
      tolerance: toDecimalString(row.tolerance),
      note: typeof row.note === "string" ? row.note : "",
      created_at: typeof row.created_at === "string" ? row.created_at : "",
      created_by: typeof row.created_by === "string" ? row.created_by : "",
    }));
}

export function sanitizeWIPActivityEntries(
  payload: unknown,
): WIPActivityEntryDTO[] {
  const raw = unwrapBackendPayload(payload);
  const rows = isRecord(raw) && Array.isArray(raw.rows) ? raw.rows : [];

  return rows
    .filter(
      (row): row is Record<string, unknown> =>
        isRecord(row) &&
        typeof row.journal_id === "string" &&
        typeof row.created_at === "string" &&
        typeof row.batch_code === "string",
    )
    .map((row) => ({
      journal_id: row.journal_id as string,
      created_at: row.created_at as string,
      batch_code: row.batch_code as string,
      item_sku: typeof row.item_sku === "string" ? row.item_sku : "",
      item_name: typeof row.item_name === "string" ? row.item_name : "",
      workstation:
        typeof row.workstation === "string" ? row.workstation : "UNKNOWN",
      input_qty: toDecimalString(row.input_qty),
      output_qty: toDecimalString(row.output_qty),
      scrap_qty: toDecimalString(row.scrap_qty),
      short_qty: toDecimalString(row.short_qty),
      difference: toDecimalString(row.difference),
      status: typeof row.status === "string" ? row.status : "FLAGGED",
      approval_state:
        typeof row.approval_state === "string" ? row.approval_state : "FINAL",
      operator_name:
        typeof row.operator_name === "string" ? row.operator_name : "",
    }));
}
