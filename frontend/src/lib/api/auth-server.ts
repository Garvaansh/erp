type BackendLoginResponse = {
  token?: unknown;
  expires_in?: unknown;
  expires_at?: unknown;
  message?: unknown;
};

type AuthSuccess = {
  ok: true;
  message: string;
  token: string;
  sessionMaxAge: number;
};

type AuthFailure = {
  ok: false;
  message: string;
};

export type BackendAuthResult = AuthSuccess | AuthFailure;

function readMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof (payload as { message?: unknown }).message === "string"
  ) {
    const value = ((payload as { message?: string }).message ?? "").trim();
    return value || fallback;
  }

  return fallback;
}

function getBackendBaseUrl(): string | null {
  const backend = process.env.NEXT_BACKEND_API_URL?.trim();
  if (backend) {
    return backend.replace(/\/$/, "");
  }

  const publicApi = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!publicApi) {
    return null;
  }

  const normalized = publicApi.replace(/\/$/, "");
  return normalized.endsWith("/v1") ? normalized.slice(0, -3) : normalized;
}

function resolveSessionMaxAge(payload: BackendLoginResponse): number | null {
  if (
    typeof payload.expires_in === "number" &&
    Number.isFinite(payload.expires_in)
  ) {
    const seconds = Math.floor(payload.expires_in);
    return seconds > 0 ? seconds : null;
  }

  if (
    typeof payload.expires_at === "number" &&
    Number.isFinite(payload.expires_at)
  ) {
    const seconds = Math.floor(payload.expires_at - Date.now() / 1000);
    return seconds > 0 ? seconds : null;
  }

  return null;
}

export async function authenticateWithBackend(
  email: string,
  password: string,
): Promise<BackendAuthResult> {
  const backendBaseUrl = getBackendBaseUrl();
  if (!backendBaseUrl) {
    return {
      ok: false,
      message: "Authentication service unavailable.",
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(`${backendBaseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const payload = (await response
      .json()
      .catch(() => null)) as BackendLoginResponse | null;

    if (!response.ok) {
      return {
        ok: false,
        message: readMessage(payload, "Invalid credentials."),
      };
    }

    const token =
      payload && typeof payload.token === "string" ? payload.token : "";
    const sessionMaxAge = payload ? resolveSessionMaxAge(payload) : null;

    if (!token || !sessionMaxAge) {
      return {
        ok: false,
        message: "Authentication failed.",
      };
    }

    return {
      ok: true,
      message: "Login successful.",
      token,
      sessionMaxAge,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        message: "Authentication backend timeout.",
      };
    }

    return {
      ok: false,
      message: "Authentication service unavailable.",
    };
  }
}
