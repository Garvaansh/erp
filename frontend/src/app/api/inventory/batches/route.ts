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

type BatchOption = {
  batch_id: string;
  batch_code: string;
  arrival_date: string | null;
  current_weight: number;
  label: string;
};

function extractBatchCode(label: string): string {
  const [batchCode] = label.split(" (");
  return batchCode?.trim() || "UNKNOWN";
}

function deriveArrivalDate(batchCode: string): string | null {
  const ddmmyyyy = batchCode.match(/-(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month}-${day}`;
  }

  const yyyymmdd = batchCode.match(/-(\d{8})-/);
  if (yyyymmdd) {
    const [year, month, day] = [
      yyyymmdd[1].slice(0, 4),
      yyyymmdd[1].slice(4, 6),
      yyyymmdd[1].slice(6, 8),
    ];
    return `${year}-${month}-${day}`;
  }

  return null;
}

function sanitizeBatches(payload: unknown): BatchOption[] {
  const rows = unwrapBackendPayload(payload);
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter(
      (row): row is Record<string, unknown> =>
        isRecord(row) &&
        typeof row.batch_id === "string" &&
        typeof row.label === "string" &&
        typeof row.remaining_qty === "number",
    )
    .map((row) => ({
      batch_id: row.batch_id as string,
      batch_code: extractBatchCode(row.label as string),
      arrival_date: deriveArrivalDate(extractBatchCode(row.label as string)),
      current_weight: row.remaining_qty as number,
      label: row.label as string,
    }));
}

export async function GET(request: NextRequest) {
  const itemID =
    request.nextUrl.searchParams.get("productId")?.trim() ??
    request.nextUrl.searchParams.get("item_id")?.trim() ??
    "";
  if (!itemID) {
    return apiError("productId query parameter is required", 400);
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
    const targetURL = new URL(`${backendURL}/api/v1/inventory/batches`);
    targetURL.searchParams.set("item_id", itemID);

    backendResponse = await fetchWithTimeout(targetURL.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    if (error instanceof BackendTimeoutError) {
      return apiError("Inventory backend timeout", 504);
    }

    return apiError("Inventory service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to fetch active batches"),
      backendResponse.status,
    );
  }

  return apiSuccess("Active batches fetched", {
    batches: sanitizeBatches(payload),
  });
}
