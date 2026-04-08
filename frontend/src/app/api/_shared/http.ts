import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export type ApiStatus = "success" | "error";

export type ApiEnvelope<T = unknown> = {
  status: ApiStatus;
  message: string;
  data?: T;
};

export class BackendTimeoutError extends Error {
  constructor(message = "Backend request timed out") {
    super(message);
    this.name = "BackendTimeoutError";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function apiSuccess<T>(
  message: string,
  data?: T,
  status = 200,
): NextResponse<ApiEnvelope<T>> {
  return NextResponse.json(
    data === undefined
      ? { status: "success", message }
      : { status: "success", message, data },
    { status },
  );
}

export function apiError(
  message: string,
  status = 400,
  data?: unknown,
): NextResponse<ApiEnvelope<unknown>> {
  return NextResponse.json(
    data === undefined
      ? { status: "error", message }
      : { status: "error", message, data },
    { status },
  );
}

export async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new BackendTimeoutError(`Backend timeout after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function readMessage(payload: unknown, fallback: string): string {
  if (
    isRecord(payload) &&
    typeof payload.message === "string" &&
    payload.message.trim()
  ) {
    return payload.message;
  }

  return fallback;
}

export function unwrapBackendPayload(payload: unknown): unknown {
  if (isRecord(payload) && "data" in payload) {
    return payload.data;
  }

  return payload;
}

export function getBackendBaseUrl(): string | null {
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

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value?.trim();
  return token || null;
}
