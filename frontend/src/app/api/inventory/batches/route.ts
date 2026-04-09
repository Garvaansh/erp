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
  arrival_date: string;
  initial_weight: number;
  remaining_weight: number;
  status: "NEW" | "IN USE";
};

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
        typeof row.batch_code === "string" &&
        typeof row.arrival_date === "string" &&
        typeof row.initial_weight === "number" &&
        typeof row.remaining_weight === "number" &&
        (row.status === "NEW" || row.status === "IN USE"),
    )
    .map((row) => ({
      batch_id: row.batch_id as string,
      batch_code: row.batch_code as string,
      arrival_date: row.arrival_date as string,
      initial_weight: row.initial_weight as number,
      remaining_weight: row.remaining_weight as number,
      status: row.status as "NEW" | "IN USE",
    }));
}

export async function GET(request: NextRequest) {
  const itemID = request.nextUrl.searchParams.get("item_id")?.trim() ?? "";
  if (!itemID) {
    return apiError("item_id query parameter is required", 400);
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
