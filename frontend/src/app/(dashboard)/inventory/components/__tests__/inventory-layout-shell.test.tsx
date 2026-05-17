// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InventoryLayoutShell,
  resolveInventoryTab,
} from "@/app/(dashboard)/inventory/components/inventory-layout-shell";

const pushMock = vi.fn();
const pathnameMock = vi.fn(() => "/inventory/finished-goods/product-1");

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("InventoryLayoutShell", () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  it("derives the active tab from detail routes", () => {
    expect(resolveInventoryTab("/inventory/raw-materials/item-1")).toBe(
      "raw-materials",
    );
    expect(resolveInventoryTab("/inventory/finished-goods/product-1")).toBe(
      "finished-goods",
    );
  });

  it("renders pathname-driven active tabs and routes through router.push", () => {
    render(
      <InventoryLayoutShell>
        <div>Inventory body</div>
      </InventoryLayoutShell>,
    );

    expect(
      screen.getByRole("button", { name: "Finished Goods" }).getAttribute(
        "aria-current",
      ),
    ).toBe("page");

    fireEvent.click(screen.getByRole("button", { name: "Raw Materials" }));

    expect(pushMock).toHaveBeenCalledWith("/inventory/raw-materials");
  });
});
