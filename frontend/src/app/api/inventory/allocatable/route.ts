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

/**
 * GET /api/inventory/allocatable?item_id=<uuid>&type=RAW|MOLDED
 *
 * Returns the total allocatable (ACTIVE, remaining_qty > 0) qty for an item
 * filtered by batch type. Used by WIP dialogs to show inventory context cards.
 *
 * Proxies to:  GET /api/v1/inventory/batches?item_id=<id>&type=<type>
 * Then aggregates remaining_qty server-side — the frontend never sees raw batch IDs.
 */
export async function GET(request: NextRequest) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) return apiError("Inventory service unavailable", 500);

  const token = await getSessionToken();
  if (!token) return apiError("Unauthorized", 401);

  const itemId = request.nextUrl.searchParams.get("item_id")?.trim();
  const batchType = request.nextUrl.searchParams.get("type")?.trim();

  if (!itemId) return apiError("item_id is required", 400);
  if (!batchType || !["RAW", "MOLDED", "FINISHED"].includes(batchType)) {
    return apiError("type must be RAW, MOLDED, or FINISHED", 400);
  }

  const targetURL = new URL(`${backendURL}/api/v1/inventory/batches`);
  targetURL.searchParams.set("item_id", itemId);
  targetURL.searchParams.set("type", batchType);
  targetURL.searchParams.set("status", "ACTIVE");

  let res: Response;
  try {
    res = await fetchWithTimeout(targetURL.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch (e) {
    if (e instanceof BackendTimeoutError) return apiError("Inventory backend timeout", 504);
    return apiError("Inventory service unavailable", 503);
  }

  const payload = await parseJson(res);
  if (!res.ok) {
    return apiError(readMessage(payload, "Failed to fetch inventory"), res.status);
  }

  // Aggregate remaining_qty — never expose batch IDs to the frontend
  const rawBatches = isRecord(payload) && Array.isArray((payload as Record<string,unknown>).batches)
    ? (payload as Record<string,unknown>).batches as unknown[]
    : isRecord(payload) && isRecord((payload as Record<string,unknown>).data) && Array.isArray(((payload as Record<string,unknown>).data as Record<string,unknown>).batches)
    ? (((payload as Record<string,unknown>).data as Record<string,unknown>).batches) as unknown[]
    : [];

  let totalQty = 0;
  let batchCount = 0;

  for (const batch of rawBatches) {
    if (!isRecord(batch)) continue;
    const rq = batch.remaining_qty;
    const qty =
      typeof rq === "number"
        ? rq
        : typeof rq === "string"
        ? parseFloat(rq)
        : 0;
    if (Number.isFinite(qty) && qty > 0) {
      totalQty += qty;
      batchCount += 1;
    }
  }

  return apiSuccess("Allocatable stock fetched", {
    item_id: itemId,
    batch_type: batchType,
    available_qty: Math.round(totalQty * 10000) / 10000,
    batch_count: batchCount,
  });
}
