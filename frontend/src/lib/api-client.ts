import { API_PATH_PREFIX, DEFAULT_APP_ORIGIN } from "@/lib/constants";

export type ApiEnvelope<T = unknown> = {
  status: "success" | "error";
  message: string;
  data?: T;
};

export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly data?: unknown;

  constructor(message: string, statusCode: number, data?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.data = data;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return (
    isRecord(value) &&
    (value.status === "success" || value.status === "error") &&
    typeof value.message === "string"
  );
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeApiPath(path: string): string {
  if (path.startsWith(API_PATH_PREFIX)) {
    return path;
  }

  return `${API_PATH_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
}

async function resolveApiUrl(path: string): Promise<string> {
  const normalizedPath = normalizeApiPath(path);

  if (typeof window !== "undefined") {
    return normalizedPath;
  }

  const configuredBaseUrl =
    process.env.NEXT_SERVER_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredBaseUrl) {
    return `${configuredBaseUrl.replace(/\/$/, "")}${normalizedPath}`;
  }

  try {
    const { headers } = await import("next/headers");
    const incomingHeaders = await headers();
    const host =
      incomingHeaders.get("x-forwarded-host") ?? incomingHeaders.get("host");
    const protocol = incomingHeaders.get("x-forwarded-proto") ?? "http";

    if (host) {
      return `${protocol}://${host}${normalizedPath}`;
    }
  } catch {
    // Fallback below.
  }

  return `${DEFAULT_APP_ORIGIN}${normalizedPath}`;
}

async function getServerCookieHeader(): Promise<string | null> {
  if (typeof window !== "undefined") {
    return null;
  }

  try {
    const { headers } = await import("next/headers");
    const incomingHeaders = await headers();
    return incomingHeaders.get("cookie");
  } catch {
    return null;
  }
}

export async function apiClient<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = await resolveApiUrl(path);
  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");

  if (init.body !== undefined && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const serverCookie = await getServerCookieHeader();
  if (serverCookie && !headers.has("Cookie")) {
    headers.set("Cookie", serverCookie);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiClientError("Request timeout", 504);
    }

    throw new ApiClientError("Service unavailable", 503);
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = await parseJson(response);
  if (!isApiEnvelope(payload)) {
    throw new ApiClientError(
      response.ok ? "Unexpected API response" : "Request failed",
      response.status || 500,
      payload,
    );
  }

  if (!response.ok || payload.status === "error") {
    throw new ApiClientError(
      payload.message || "Request failed",
      response.status || 500,
      payload.data,
    );
  }

  return payload.data as T;
}
