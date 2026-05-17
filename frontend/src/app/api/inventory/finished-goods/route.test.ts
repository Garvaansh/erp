// @vitest-environment node

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

import { GET } from "./route";

describe("finished goods route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedHttp.getBackendBaseUrl.mockReturnValue("http://backend.test");
    sharedHttp.getSessionToken.mockResolvedValue("session-token");
    sharedHttp.fetchWithTimeout.mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              item_id: "11111111-1111-1111-1111-111111111111",
              sku: "FGP-001",
              name: "Curtain Pipe 25mm",
              diameter: 25,
              available_qty: 120,
              reserved_qty: 0,
              status: "OK",
            },
          ],
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

  it("sanitizes the finished goods master response", async () => {
    const response = await GET();

    expect(sharedHttp.fetchWithTimeout).toHaveBeenCalledWith(
      "http://backend.test/api/v1/inventory/finished-goods",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer session-token",
        }),
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      status: "success",
      data: {
        items: [
          {
            sku: "FGP-001",
            name: "Curtain Pipe 25mm",
            diameter: 25,
            status: "OK",
          },
        ],
      },
    });
  });
});
