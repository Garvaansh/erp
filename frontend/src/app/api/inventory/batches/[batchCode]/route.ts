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
  unwrapBackendPayload,
} from "@/app/api/_shared/http";

function numberOrZero(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeBatchTraceabilityPayload(data: Record<string, unknown>) {
  if (isRecord(data.batch)) {
    return data;
  }

  const header = isRecord(data.header) ? data.header : null;
  if (!header) {
    return null;
  }

  const manufacturing = isRecord(data.manufacturing) ? data.manufacturing : null;
  const lineage = Array.isArray(data.upstream_lineage)
    ? data.upstream_lineage
        .filter(isRecord)
        .map((row) => ({
          batch_id: stringOrEmpty(row.batch_id),
          batch_code: stringOrEmpty(row.batch_code),
          batch_type: stringOrEmpty(row.batch_type),
          status: stringOrEmpty(row.status),
          initial_qty: numberOrZero(row.initial_qty),
          remaining_qty: numberOrZero(row.remaining_qty),
          quantity_consumed: numberOrZero(row.quantity_consumed),
          depth: numberOrZero(row.depth),
          created_at: stringOrEmpty(row.created_at),
          item_name: stringOrEmpty(row.item_name),
          item_sku: stringOrEmpty(row.item_sku),
        }))
    : [];

  const consumptions = Array.isArray(data.consumption_events)
    ? data.consumption_events
        .filter(isRecord)
        .map((row) => ({
          id: stringOrEmpty(row.id),
          production_run_id: stringOrEmpty(row.production_run_id),
          source_batch_code: stringOrEmpty(row.source_batch_code),
          source_batch_type: stringOrEmpty(row.source_batch_type),
          target_batch_code: stringOrEmpty(row.target_batch_code),
          target_batch_type: stringOrEmpty(row.target_batch_type),
          quantity_consumed: numberOrZero(row.quantity_consumed),
          batch_remaining_before: numberOrZero(row.batch_remaining_before),
          batch_remaining_after: numberOrZero(row.batch_remaining_after),
          created_at: stringOrEmpty(row.created_at),
        }))
    : [];

  const vendors = Array.isArray(data.vendor_info)
    ? data.vendor_info
        .filter(isRecord)
        .map((row) => ({
          vendor_name: stringOrEmpty(row.vendor_name),
          po_number: stringOrEmpty(row.po_number),
          procurement_date: stringOrEmpty(row.procurement_date),
          raw_batch_code: stringOrEmpty(row.raw_batch_code),
        }))
    : [];

  return {
    batch: {
      batch_id: stringOrEmpty(header.batch_id),
      batch_code: stringOrEmpty(header.batch_code),
      item_id: stringOrEmpty(header.item_id),
      batch_type: stringOrEmpty(header.batch_type),
      status: stringOrEmpty(header.status),
      initial_qty: numberOrZero(header.initial_qty),
      remaining_qty: numberOrZero(header.remaining_qty),
      reserved_qty: numberOrZero(header.reserved_qty),
      created_at: stringOrEmpty(header.created_at),
      item_name: stringOrEmpty(header.item_name),
      item_sku: stringOrEmpty(header.item_sku),
      item_category: stringOrEmpty(header.item_category),
    },
    production_run: manufacturing
      ? {
          production_run_id: stringOrEmpty(manufacturing.production_run_id),
          run_sequence: numberOrZero(manufacturing.run_sequence),
          input_qty: numberOrZero(manufacturing.input_qty),
          output_qty: numberOrZero(manufacturing.output_qty),
          scrap_qty: numberOrZero(manufacturing.scrap_qty),
          shortlength_qty: numberOrZero(manufacturing.shortlength_qty),
          process_loss_qty: numberOrZero(manufacturing.process_loss_qty),
          yield_pct: numberOrZero(manufacturing.yield_pct),
          production_stage: stringOrEmpty(manufacturing.production_stage),
          operator_name: stringOrEmpty(manufacturing.operator_name),
          status: stringOrEmpty(manufacturing.status),
          created_at: stringOrEmpty(manufacturing.created_at),
        }
      : null,
    lineage,
    consumptions,
    vendors,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ batchCode: string }> }
) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) return apiError("Inventory service unavailable", 500);

  const token = await getSessionToken();
  if (!token) return apiError("Unauthorized", 401);

  const { batchCode } = await params;
  const trimmed = decodeURIComponent(batchCode).trim();
  if (!trimmed) return apiError("Batch code is required", 400);

  const targetURL = `${backendURL}/api/v1/inventory/batches/${encodeURIComponent(trimmed)}/traceability`;

  let res: Response;
  try {
    res = await fetchWithTimeout(targetURL, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch (e) {
    if (e instanceof BackendTimeoutError)
      return apiError("Backend timeout", 504);
    return apiError("Inventory service unavailable", 503);
  }

  const payload = await parseJson(res);
  if (!res.ok)
    return apiError(
      readMessage(payload, "Failed to fetch batch traceability"),
      res.status
    );

  const data = unwrapBackendPayload(payload);
  if (!isRecord(data)) return apiError("Invalid response shape", 502);

  const normalized = normalizeBatchTraceabilityPayload(data);
  if (!normalized) return apiError("Invalid response shape", 502);

  return apiSuccess("Batch traceability fetched", normalized);
}
