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

type ProcurementBatchDTO = {
  batch_id: string;
  batch_code: string;
  initial_qty: number;
  remaining_qty: number;
  status?: string;
  unit_cost?: number;
  transaction_id?: string;
  received_at?: string;
};

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

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function sanitizeBatches(payload: unknown): ProcurementBatchDTO[] {
  const rows = unwrapBackendPayload(payload);
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter(
      (row): row is Record<string, unknown> =>
        isRecord(row) &&
        typeof row.batch_id === "string" &&
        typeof row.batch_code === "string",
    )
    .map((row) => ({
      batch_id: row.batch_id as string,
      batch_code: row.batch_code as string,
      initial_qty: toNumber(row.initial_qty),
      remaining_qty: toNumber(row.remaining_qty),
      status: typeof row.status === "string" ? row.status : undefined,
      unit_cost: toOptionalNumber(row.unit_cost),
      transaction_id:
        typeof row.transaction_id === "string" ? row.transaction_id : undefined,
      received_at:
        typeof row.received_at === "string" ? row.received_at : undefined,
    }));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ poId: string }> },
) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Procurement service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  const { poId } = await context.params;
  if (!poId?.trim()) {
    return apiError("Invalid purchase order reference", 400);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(
      `${backendURL}/api/v1/procurement/${encodeURIComponent(poId)}/batches`,
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
      return apiError("Procurement backend timeout", 504);
    }

    return apiError("Procurement service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to fetch receipt batches"),
      backendResponse.status,
    );
  }

  return apiSuccess("Procurement receipt batches fetched", {
    batches: sanitizeBatches(payload),
  });
}
