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

type SelectableItem = {
  item_id: string;
  label: string;
  category: string;
};

function sanitizeSelectableItems(payload: unknown): SelectableItem[] {
  const rows = unwrapBackendPayload(payload);
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter(
      (row): row is Record<string, unknown> =>
        isRecord(row) &&
        typeof row.item_id === "string" &&
        typeof row.label === "string" &&
        typeof row.category === "string",
    )
    .map((row) => ({
      item_id: row.item_id as string,
      label: row.label as string,
      category: row.category as string,
    }));
}

export async function GET() {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Items service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(
      `${backendURL}/api/v1/items/selectable`,
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
      return apiError("Items backend timeout", 504);
    }

    return apiError("Items service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to fetch selectable items"),
      backendResponse.status,
    );
  }

  return apiSuccess("Selectable items fetched", {
    items: sanitizeSelectableItems(payload),
  });
}
