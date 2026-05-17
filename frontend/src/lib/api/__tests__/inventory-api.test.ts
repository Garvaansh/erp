import { describe, it, expect, vi, afterEach } from "vitest";
import { updateBatchStatus } from "../inventory";

// We mock the fetch API correctly to test if apiClient parses the 'success' status envelope correctly
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("api client parsing success envelope", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("updateBatchStatus correctly parses the success envelope", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: "success", message: "Batch status updated" }),
    } as Response);

    await expect(
      updateBatchStatus("BATCH-123", { status: "HOLD" })
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/inventory/batches/BATCH-123/status"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "HOLD" }),
      })
    );
  });
});
