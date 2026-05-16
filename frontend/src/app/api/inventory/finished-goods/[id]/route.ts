import { NextRequest } from "next/server";
import {
  apiError,
  apiSuccess,
  BackendTimeoutError,
  fetchWithTimeout,
  getBackendBaseUrl,
  getSessionToken,
  isRecord,
  parseJson,
  readMessage,
} from "@/app/api/_shared/http";

function toNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sanitizeBatchStatus(value: unknown) {
  if (
    value === "ACTIVE" ||
    value === "HOLD" ||
    value === "EXHAUSTED" ||
    value === "REVERSED"
  ) {
    return value;
  }

  return "ACTIVE";
}

function sanitizeLineageRows(rows: unknown) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter((row) => isRecord(row) && typeof row.batch_id === "string")
    .map((row) => ({
      batch_id: toStringValue(row.batch_id),
      batch_code: toStringValue(row.batch_code),
      created_at: toStringValue(row.created_at),
      status: sanitizeBatchStatus(row.status),
      available_qty: toNumber(row.available_qty),
      produced_qty:
        typeof row.produced_qty === "number" ? row.produced_qty : undefined,
      latest_used_at:
        typeof row.latest_used_at === "string" ? row.latest_used_at : undefined,
      vendor_name:
        typeof row.vendor_name === "string" ? row.vendor_name : undefined,
      po_number: typeof row.po_number === "string" ? row.po_number : undefined,
    }));
}

function sanitizeDetail(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.summary)) {
    return null;
  }

  const summary = payload.summary;

  return {
    summary: {
      item_id: toStringValue(summary.item_id),
      sku: toStringValue(summary.sku),
      name: toStringValue(summary.name),
      diameter: toNumber(summary.diameter),
      total_qty: toNumber(summary.total_qty),
      available_qty: toNumber(summary.available_qty),
      reserved_qty: toNumber(summary.reserved_qty),
      hold_qty: toNumber(summary.hold_qty),
      status:
        summary.status === "LOW" || summary.status === "OUT"
          ? summary.status
          : "OK",
      batch_count: toNumber(summary.batch_count),
      linked_raw_material_id:
        typeof summary.linked_raw_material_id === "string"
          ? summary.linked_raw_material_id
          : undefined,
      linked_raw_material_sku:
        typeof summary.linked_raw_material_sku === "string"
          ? summary.linked_raw_material_sku
          : undefined,
      linked_raw_material_name:
        typeof summary.linked_raw_material_name === "string"
          ? summary.linked_raw_material_name
          : undefined,
      linked_raw_material_specification:
        typeof summary.linked_raw_material_specification === "string"
          ? summary.linked_raw_material_specification
          : undefined,
    },
    batches: Array.isArray(payload.batches)
      ? payload.batches
          .filter((row) => isRecord(row) && typeof row.batch_id === "string")
          .map((row) => ({
            batch_id: toStringValue(row.batch_id),
            batch_code: toStringValue(row.batch_code),
            created_at: toStringValue(row.created_at),
            initial_qty: toNumber(row.initial_qty),
            remaining_qty: toNumber(row.remaining_qty),
            reserved_qty: toNumber(row.reserved_qty),
            available_qty: toNumber(row.available_qty),
            status: sanitizeBatchStatus(row.status),
            source_molded_batch_id:
              typeof row.source_molded_batch_id === "string"
                ? row.source_molded_batch_id
                : undefined,
            source_molded_batch_code:
              typeof row.source_molded_batch_code === "string"
                ? row.source_molded_batch_code
                : undefined,
          }))
      : [],
    recent_polishing_output: Array.isArray(payload.recent_polishing_output)
      ? payload.recent_polishing_output
          .filter((row) => isRecord(row) && typeof row.journal_id === "string")
          .map((row) => ({
            journal_id: toStringValue(row.journal_id),
            created_at: toStringValue(row.created_at),
            finished_batch_id: toStringValue(row.finished_batch_id),
            finished_batch_code: toStringValue(row.finished_batch_code),
            source_molded_batch_id:
              typeof row.source_molded_batch_id === "string"
                ? row.source_molded_batch_id
                : undefined,
            source_molded_batch_code:
              typeof row.source_molded_batch_code === "string"
                ? row.source_molded_batch_code
                : undefined,
            output_qty: toStringValue(row.output_qty),
            scrap_qty: toStringValue(row.scrap_qty),
            shortlength_qty: toStringValue(row.shortlength_qty),
            process_loss_qty: toStringValue(row.process_loss_qty),
            operator_name:
              typeof row.operator_name === "string"
                ? row.operator_name
                : undefined,
          }))
      : [],
    source_molded_batches: sanitizeLineageRows(payload.source_molded_batches),
    source_raw_batches: sanitizeLineageRows(payload.source_raw_batches),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const trimmedId = id?.trim();
  if (!trimmedId) {
    return apiError("Product ID is required", 400);
  }

  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Inventory service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(
      `${backendURL}/api/v1/inventory/finished-goods/${encodeURIComponent(trimmedId)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );
  } catch (error) {
    if (error instanceof BackendTimeoutError) {
      return apiError("Inventory backend timeout", 504);
    }

    return apiError("Inventory service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to load finished good detail"),
      backendResponse.status,
    );
  }

  const detail = sanitizeDetail(payload);
  if (!detail) {
    return apiError("Malformed finished good detail response", 502);
  }

  return apiSuccess("Finished good detail loaded", detail);
}
