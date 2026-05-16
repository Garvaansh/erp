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

// DTO shape returned by GET /api/v1/wip/runs
type WIPRunDTO = {
  run_id: string;
  run_sequence: number;
  output_batch_code: string;
  workstation: string;
  input_qty: number;
  output_qty: number;
  scrap_qty: number;
  shortlength_qty: number;
  process_loss_qty: number;
  batches_consumed: number;
  status: string;
  created_at: string;
  // Joined fields from backend query (operator name, item name/sku)
  operator_name?: string;
  item_name?: string;
  item_sku?: string;
  run_type?: string;
};

function sanitizeRun(row: unknown): WIPRunDTO | null {
  if (!isRecord(row) || typeof row.run_id !== "string") return null;
  return {
    run_id: row.run_id as string,
    run_sequence: typeof row.run_sequence === "number" ? row.run_sequence : 0,
    output_batch_code:
      typeof row.output_batch_code === "string" ? row.output_batch_code : "",
    workstation:
      typeof row.workstation === "string" ? row.workstation : "UNKNOWN",
    input_qty: typeof row.input_qty === "number" ? row.input_qty : 0,
    output_qty: typeof row.output_qty === "number" ? row.output_qty : 0,
    scrap_qty: typeof row.scrap_qty === "number" ? row.scrap_qty : 0,
    shortlength_qty:
      typeof row.shortlength_qty === "number" ? row.shortlength_qty : 0,
    process_loss_qty:
      typeof row.process_loss_qty === "number" ? row.process_loss_qty : 0,
    batches_consumed:
      typeof row.batches_consumed === "number" ? row.batches_consumed : 0,
    status: typeof row.status === "string" ? row.status : "COMPLETED",
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    operator_name:
      typeof row.operator_name === "string" ? row.operator_name : undefined,
    item_name:
      typeof row.output_item_name === "string"
        ? row.output_item_name
        : undefined,
    item_sku:
      typeof row.output_item_sku === "string" ? row.output_item_sku : undefined,
    run_type: typeof row.run_type === "string" ? row.run_type : undefined,
  };
}

export async function GET(request: NextRequest) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) return apiError("WIP service unavailable", 500);

  const token = await getSessionToken();
  if (!token) return apiError("Unauthorized", 401);

  const { searchParams } = request.nextUrl;
  const targetURL = new URL(`${backendURL}/api/v1/wip/runs`);
  ["page", "page_size"].forEach((k) => {
    const v = searchParams.get(k);
    if (v) targetURL.searchParams.set(k, v);
  });

  const outputItemID =
    searchParams.get("output_item_id") ?? searchParams.get("item_id");
  if (outputItemID) {
    targetURL.searchParams.set("output_item_id", outputItemID);
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(targetURL.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch (e) {
    if (e instanceof BackendTimeoutError)
      return apiError("WIP backend timeout", 504);
    return apiError("WIP service unavailable", 503);
  }

  const payload = await parseJson(res);
  if (!res.ok)
    return apiError(readMessage(payload, "Failed to fetch runs"), res.status);

  // Backend returns { rows: [...] }
  const raw =
    isRecord(payload) &&
    Array.isArray((payload as Record<string, unknown>).rows)
      ? (payload as Record<string, unknown>).rows
      : isRecord(payload) &&
          Array.isArray((payload as Record<string, unknown>).runs)
        ? (payload as Record<string, unknown>).runs
        : [];

  const runs = (raw as unknown[])
    .map(sanitizeRun)
    .filter(Boolean) as WIPRunDTO[];
  return apiSuccess("Production runs fetched", { runs });
}
