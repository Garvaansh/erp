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

export async function POST(
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
    backendResponse = await fetchWithTimeout(
      `${backendURL}/api/v1/users/${userId}/password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body,
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
      readMessage(payload, "Failed to reset password"),
      backendResponse.status,
    );
  }

  return apiSuccess("Password updated", null, 200);
}
