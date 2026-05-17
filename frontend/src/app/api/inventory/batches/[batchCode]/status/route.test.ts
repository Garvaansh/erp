// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sharedHttp = vi.hoisted(() => ({
  fetchWithTimeout: vi.fn(),
  getBackendBaseUrl: vi.fn(),
  getSessionToken: vi.fn(),
}));

vi.mock("@/app/api/_shared/http", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/_shared/http")>(
    "@/app/api/_shared/http",
  );

  return {
    ...actual,
    fetchWithTimeout: sharedHttp.fetchWithTimeout,
    getBackendBaseUrl: sharedHttp.getBackendBaseUrl,
    getSessionToken: sharedHttp.getSessionToken,
  };
});

import { PATCH } from "./route";

describe("inventory batch status route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedHttp.getBackendBaseUrl.mockReturnValue("http://backend.test");
    sharedHttp.getSessionToken.mockResolvedValue("session-token");
    sharedHttp.fetchWithTimeout.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ok",
          message: "Batch status updated",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
  });

  it("forwards the hold payload to the backend patch endpoint", async () => {
    const request = new NextRequest(
      "http://localhost/api/inventory/batches/BATCH-1/status",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "HOLD" }),
      },
    );

    const response = await PATCH(request, {
      params: Promise.resolve({ batchCode: "BATCH-1" }),
    });

    expect(sharedHttp.fetchWithTimeout).toHaveBeenCalledWith(
      "http://backend.test/api/v1/inventory/batches/BATCH-1/status",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: "Bearer session-token",
        }),
        body: JSON.stringify({ status: "HOLD" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "success",
      message: "Batch status updated",
    });
  });
});
