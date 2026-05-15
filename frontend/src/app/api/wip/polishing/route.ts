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

async function proxyWIPPost(
  request: NextRequest,
  endpoint: "molding" | "polishing",
) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) return apiError("WIP service unavailable", 500);

  const token = await getSessionToken();
  if (!token) return apiError("Unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body", 400);
  }

  if (!isRecord(body)) return apiError("Invalid payload shape", 400);

  const clean = {
    output_item_id:
      typeof body.output_item_id === "string" ? body.output_item_id.trim() : "",
    input_qty: typeof body.input_qty === "number" ? body.input_qty : 0,
    output_qty: typeof body.output_qty === "number" ? body.output_qty : 0,
    scrap_qty: typeof body.scrap_qty === "number" ? body.scrap_qty : 0,
    shortlength_qty:
      typeof body.shortlength_qty === "number" ? body.shortlength_qty : 0,
    notes: typeof body.notes === "string" ? body.notes.trim() : "",
  };

  if (!clean.output_item_id) return apiError("output_item_id is required", 400);

  let res: Response;
  try {
    res = await fetchWithTimeout(`${backendURL}/api/v1/wip/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(clean),
    });
  } catch (e) {
    if (e instanceof BackendTimeoutError) return apiError("WIP backend timeout", 504);
    return apiError("WIP service unavailable", 503);
  }

  const payload = await parseJson(res);
  if (!res.ok) {
    const msg = readMessage(payload, `Failed to log ${endpoint} run`);
    const code =
      isRecord(payload) && typeof payload.code === "string"
        ? payload.code
        : undefined;
    return apiError(msg, res.status, code ? { code } : undefined);
  }

  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
  const result = {
    run_id: isRecord(data) && typeof data.run_id === "string" ? data.run_id : "",
    output_batch_code:
      isRecord(data) && typeof data.output_batch_code === "string"
        ? data.output_batch_code
        : "",
    batches_consumed:
      isRecord(data) && typeof data.batches_consumed === "number"
        ? data.batches_consumed
        : 0,
    status: isRecord(data) && typeof data.status === "string" ? data.status : "COMPLETED",
  };

  return apiSuccess(`${endpoint} run logged`, result, 201);
}

export async function POST(request: NextRequest) {
  return proxyWIPPost(request, "polishing");
}
