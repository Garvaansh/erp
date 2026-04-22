import {
  apiError,
  apiSuccess,
  BackendTimeoutError,
  fetchWithTimeout,
  getBackendBaseUrl,
  getSessionToken,
  parseJson,
  readMessage,
} from "@/app/api/_shared/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;

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
    backendResponse = await fetchWithTimeout(
      `${backendURL}/api/v1/users/${userId}`,
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
      return apiError("Users backend timeout", 504);
    }
    return apiError("Users service unavailable", 503);
  }

  const payload = await parseJson(backendResponse);
  if (!backendResponse.ok) {
    return apiError(
      readMessage(payload, "Failed to fetch user"),
      backendResponse.status,
    );
  }

  return apiSuccess("User loaded", payload, 200);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;

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
    backendResponse = await fetchWithTimeout(`${backendURL}/api/v1/users/${userId}`, {
      method: "PATCH",
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
      readMessage(payload, "Failed to update user"),
      backendResponse.status,
    );
  }

  return apiSuccess("User updated", null, 200);
}
