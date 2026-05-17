import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

import InventoryPage from "./page";

describe("inventory index route", () => {
  it("redirects to the raw materials route", () => {
    InventoryPage();

    expect(redirectMock).toHaveBeenCalledWith("/inventory/raw-materials");
  });
});
