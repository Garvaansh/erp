import {
  apiError,
  apiSuccess,
  BackendTimeoutError,
  fetchWithTimeout,
  getBackendBaseUrl,
  getSessionToken,
  parseJson,
  readMessage,
  unwrapBackendPayload,
} from "@/app/api/_shared/http";

function parseDate(input: string | null): Date | null {
  if (!input) {
    return null;
  }

  const parsed = new Date(`${input}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDays(from: Date | null, to: Date | null): number {
  if (!from || !to || from > to) {
    return 30;
  }

  const msInDay = 24 * 60 * 60 * 1000;
  return Math.max(Math.floor((to.getTime() - from.getTime()) / msInDay) + 1, 1);
}

export async function GET(request: Request) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) return apiError("Reports service unavailable", 500);
  const token = await getSessionToken();
  if (!token) return apiError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"));
  const days = String(toDays(from, to));

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${backendURL}/api/v1/reports/inventory?days=${days}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );
  } catch (e) {
    return e instanceof BackendTimeoutError
      ? apiError("Reports backend timeout", 504)
      : apiError("Reports service unavailable", 503);
  }

  const payload = await parseJson(res);
  if (!res.ok)
    return apiError(
      readMessage(payload, "Failed to load inventory report"),
      res.status,
    );
  const data = unwrapBackendPayload(payload);
  return apiSuccess("Inventory report loaded", data, 200);
}
