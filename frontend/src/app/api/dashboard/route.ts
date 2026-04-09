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

type DashboardSummary = {
  total_raw_material_weight: number;
  total_finished_pipes_weight: number;
  recent_activity: Array<{
    journal_id: string;
    created_at: string;
    worker_name: string;
    source_batch: string;
    input_qty: number;
    finished_qty: number;
    scrap_qty: number;
  }>;
};

function sanitizeSummary(payload: unknown): DashboardSummary {
  const rawPayload = unwrapBackendPayload(payload);
  if (!isRecord(rawPayload)) {
    return {
      total_raw_material_weight: 0,
      total_finished_pipes_weight: 0,
      recent_activity: [],
    };
  }

  return {
    total_raw_material_weight:
      typeof rawPayload.total_raw_material_weight === "number"
        ? rawPayload.total_raw_material_weight
        : 0,
    total_finished_pipes_weight:
      typeof rawPayload.total_finished_pipes_weight === "number"
        ? rawPayload.total_finished_pipes_weight
        : 0,
    recent_activity: Array.isArray(rawPayload.recent_activity)
      ? rawPayload.recent_activity.filter(
          (row): row is DashboardSummary["recent_activity"][number] =>
            isRecord(row) &&
            typeof row.journal_id === "string" &&
            typeof row.created_at === "string" &&
            typeof row.worker_name === "string" &&
            typeof row.source_batch === "string" &&
            typeof row.input_qty === "number" &&
            typeof row.finished_qty === "number" &&
            typeof row.scrap_qty === "number",
        )
      : [],
  };
}

export async function GET() {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Dashboard service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(`${backendURL}/api/v1/dashboard`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    if (error instanceof BackendTimeoutError) {
      return apiError("Dashboard backend timeout", 504);
    }

    return apiError("Dashboard service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to load dashboard"),
      backendResponse.status,
    );
  }

  return apiSuccess("Dashboard loaded", sanitizeSummary(payload), 200);
}
