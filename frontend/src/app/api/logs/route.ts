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

type DailyLogBody = {
  source_batch_id?: unknown;
  output_item_name?: unknown;
  output_item_specs?: unknown;
  input_qty?: unknown;
  finished_qty?: unknown;
  scrap_qty?: unknown;
};

function validSpecs(value: unknown): value is {
  thickness: number;
  width: number;
  grade: string;
  coil_weight: number;
} {
  return (
    isRecord(value) &&
    typeof value.thickness === "number" &&
    !Number.isNaN(value.thickness) &&
    value.thickness > 0 &&
    typeof value.width === "number" &&
    !Number.isNaN(value.width) &&
    value.width > 0 &&
    typeof value.grade === "string" &&
    value.grade.trim() !== "" &&
    typeof value.coil_weight === "number" &&
    !Number.isNaN(value.coil_weight) &&
    value.coil_weight > 0
  );
}

export async function POST(request: NextRequest) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Daily log service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  let body: DailyLogBody;
  try {
    body = (await request.json()) as DailyLogBody;
  } catch {
    return apiError("Invalid JSON payload", 400);
  }

  const sourceBatchID =
    typeof body.source_batch_id === "string" ? body.source_batch_id.trim() : "";
  const outputItemName =
    typeof body.output_item_name === "string"
      ? body.output_item_name.trim()
      : "";
  const inputQty = Number(body.input_qty);
  const finishedQty = Number(body.finished_qty);
  const scrapQty = Number(body.scrap_qty);

  if (
    !sourceBatchID ||
    !outputItemName ||
    Number.isNaN(inputQty) ||
    Number.isNaN(finishedQty) ||
    Number.isNaN(scrapQty) ||
    !validSpecs(body.output_item_specs)
  ) {
    return apiError("Missing or invalid log fields", 400);
  }

  const outputItemSpecs = body.output_item_specs;

  const backendBody = {
    source_batch_id: sourceBatchID,
    output_item_name: outputItemName,
    output_item_specs: {
      thickness: outputItemSpecs.thickness,
      width: outputItemSpecs.width,
      grade: outputItemSpecs.grade.trim(),
      coil_weight: outputItemSpecs.coil_weight,
    },
    input_qty: inputQty,
    finished_qty: finishedQty,
    scrap_qty: scrapQty,
  };

  const idempotencyKey =
    request.headers.get("Idempotency-Key")?.trim() || crypto.randomUUID();

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(`${backendURL}/api/v1/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(backendBody),
    });
  } catch (error) {
    if (error instanceof BackendTimeoutError) {
      return apiError("Daily log backend timeout", 504);
    }

    return apiError("Daily log service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to submit daily log"),
      backendResponse.status,
    );
  }

  if (
    !isRecord(payload) ||
    payload.success !== true ||
    typeof payload.journal_id !== "string"
  ) {
    return apiError("Invalid daily log response", 502);
  }

  return apiSuccess(
    "Daily log submitted",
    {
      success: true,
      journal_id: payload.journal_id,
    },
    200,
  );
}
