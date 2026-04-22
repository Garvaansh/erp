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

export async function GET(request: Request) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Users service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  let backendResponse: Response;
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") ?? "";
    const search = searchParams.get("search") ?? "";
    const query = new URLSearchParams();
    if (filter) query.set("filter", filter);
    if (search) query.set("search", search);

    backendResponse = await fetchWithTimeout(`${backendURL}/api/v1/users/?${query.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    if (error instanceof BackendTimeoutError) {
      return apiError("Users backend timeout", 504);
    }
    return apiError("Users service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to load users"),
      backendResponse.status,
    );
  }

  // Extract data from backend { status, data }
  const data = isRecord(payload) && Array.isArray((payload as Record<string, unknown>).data) ? (payload as Record<string, unknown>).data : [];

  return apiSuccess("Users loaded", data, 200);
}

export async function POST(request: Request) {
  const backendURL = getBackendBaseUrl();
  if (!backendURL) {
    return apiError("Users service unavailable", 500);
  }

  const token = await getSessionToken();
  if (!token) {
    return apiError("Unauthorized", 401);
  }

  let body: string;
  try {
    body = JSON.stringify(await request.json());
  } catch {
    return apiError("Invalid JSON payload", 400);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(`${backendURL}/api/v1/users/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
    });
  } catch (error) {
    if (error instanceof BackendTimeoutError) {
      return apiError("Users backend timeout", 504);
    }
    return apiError("Users service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to create user"),
      backendResponse.status,
    );
  }

  const data = isRecord(payload) ? (payload as Record<string, unknown>).data : null;
  return apiSuccess("User created", data, 201);
}
