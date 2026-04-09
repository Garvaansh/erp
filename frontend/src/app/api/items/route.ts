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

type ItemDTO = {
  id: string;
  parent_id?: string;
  name: string;
  sku: string | null;
  category: string;
  base_unit: string;
  specs: Record<string, unknown>;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

function sanitizeItems(payload: unknown): ItemDTO[] {
  const data = unwrapBackendPayload(payload);
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((row) => isRecord(row) && typeof row.id === "string")
    .map((row) => ({
      id: String(row.id),
      parent_id: typeof row.parent_id === "string" ? row.parent_id : undefined,
      name: typeof row.name === "string" ? row.name : "",
      sku: typeof row.sku === "string" ? row.sku : null,
      category: typeof row.category === "string" ? row.category : "",
      base_unit: typeof row.base_unit === "string" ? row.base_unit : "WEIGHT",
      specs: isRecord(row.specs) ? row.specs : {},
      is_active: Boolean(row.is_active),
      created_at:
        typeof row.created_at === "string" ? row.created_at : undefined,
      updated_at:
        typeof row.updated_at === "string" ? row.updated_at : undefined,
    }));
}

function sanitizeSingleItem(payload: unknown): ItemDTO | null {
  // Go CreateItem returns: { status: "success", item: { ... } }
  // NOT wrapped under { data: ... } — must look for .item key directly.
  const raw =
    isRecord(payload) && isRecord(payload.item)
      ? payload.item
      : unwrapBackendPayload(payload);

  if (!isRecord(raw) || typeof raw.id !== "string") {
    return null;
  }

  return {
    id: String(raw.id),
    parent_id: typeof raw.parent_id === "string" ? raw.parent_id : undefined,
    name: typeof raw.name === "string" ? raw.name : "",
    sku: typeof raw.sku === "string" ? raw.sku : null,
    category: typeof raw.category === "string" ? raw.category : "",
    base_unit: typeof raw.base_unit === "string" ? raw.base_unit : "WEIGHT",
    specs: isRecord(raw.specs) ? raw.specs : {},
    is_active: Boolean(raw.is_active),
    created_at: typeof raw.created_at === "string" ? raw.created_at : undefined,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : undefined,
  };
}

export async function GET(request: NextRequest) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Items service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  const category = request.nextUrl.searchParams.get("category")?.trim();
  const limit = request.nextUrl.searchParams.get("limit")?.trim();
  const offset = request.nextUrl.searchParams.get("offset")?.trim();
  const parentId = request.nextUrl.searchParams.get("parentId")?.trim();

  const targetURL = parentId
    ? new URL(
        `${backendURL}/api/v1/items/variants/${encodeURIComponent(parentId)}`,
      )
    : new URL(`${backendURL}/api/v1/items`);

  if (category && !parentId) {
    targetURL.searchParams.set("category", category);
  }
  if (limit) {
    targetURL.searchParams.set("limit", limit);
  }
  if (offset) {
    targetURL.searchParams.set("offset", offset);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(targetURL.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
  } catch (error) {
    if (error instanceof BackendTimeoutError) {
      return apiError("Items backend timeout", 504);
    }

    return apiError("Items service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to fetch items"),
      backendResponse.status,
    );
  }

  return apiSuccess("Items fetched", { items: sanitizeItems(payload) }, 200);
}

export async function POST(request: NextRequest) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Items service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON payload", 400);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(`${backendURL}/api/v1/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof BackendTimeoutError) {
      return apiError("Items backend timeout", 504);
    }

    return apiError("Items service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to create item"),
      backendResponse.status,
    );
  }

  return apiSuccess(
    "Item created",
    { item: sanitizeSingleItem(payload) },
    backendResponse.status || 201,
  );
}
