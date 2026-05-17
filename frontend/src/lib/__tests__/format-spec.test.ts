import { describe, expect, it } from "vitest";
import {
  computeStockStatus,
  formatMaterialLabel,
  formatSpecification,
  stockStatusColor,
  stockStatusLabel,
} from "@/lib/format-spec";

describe("formatSpecification", () => {
  it("formats thickness and width", () => {
    expect(formatSpecification({ thickness: 1, width: 3.5 })).toBe(
      "1mm × 3.5mm",
    );
  });

  it("handles normalized keys (thickness_mm, width_mm)", () => {
    expect(formatSpecification({ thickness_mm: 2, width_mm: 4 })).toBe(
      "2mm × 4mm",
    );
  });

  it("formats diameter only", () => {
    expect(formatSpecification({ diameter: 8 })).toBe("Ø8mm");
  });

  it("handles thickness only", () => {
    expect(formatSpecification({ thickness: 3 })).toBe("3mm");
  });

  it("handles width only", () => {
    expect(formatSpecification({ width: 5 })).toBe("5mm");
  });

  it("returns empty for null, undefined, and empty object", () => {
    expect(formatSpecification(null)).toBe("");
    expect(formatSpecification(undefined)).toBe("");
    expect(formatSpecification({})).toBe("");
  });

  it("ignores invalid numeric values", () => {
    expect(formatSpecification({ thickness: -1, width: 3 })).toBe("3mm");
    expect(formatSpecification({ thickness: 0, width: 0 })).toBe("");
  });

  it("handles fractional dimensions", () => {
    expect(formatSpecification({ thickness: 0.8, width: 12.5 })).toBe(
      "0.8mm × 12.5mm",
    );
  });
});

describe("formatMaterialLabel", () => {
  it("combines material name and specification", () => {
    expect(formatMaterialLabel("Stainless Steel", "1.5mm × 1000mm")).toBe(
      "Stainless Steel (1.5mm × 1000mm)",
    );
  });

  it("returns only the material name when spec is empty", () => {
    expect(formatMaterialLabel("Stainless Steel", "")).toBe("Stainless Steel");
  });
});

describe("computeStockStatus", () => {
  it("returns OUT_OF_STOCK when available is 0", () => {
    expect(computeStockStatus(0, 100)).toBe("OUT_OF_STOCK");
  });

  it("returns LOW_STOCK when at threshold", () => {
    expect(computeStockStatus(100, 100)).toBe("LOW_STOCK");
  });

  it("returns HEALTHY when above threshold", () => {
    expect(computeStockStatus(500, 100)).toBe("HEALTHY");
  });
});

describe("stockStatusLabel", () => {
  it("maps all statuses", () => {
    expect(stockStatusLabel("OUT_OF_STOCK")).toBe("Out of Stock");
    expect(stockStatusLabel("LOW_STOCK")).toBe("Low Stock");
    expect(stockStatusLabel("HEALTHY")).toBe("Healthy");
  });
});

describe("stockStatusColor", () => {
  it("returns semantic color classes", () => {
    expect(stockStatusColor("OUT_OF_STOCK")).toContain("red");
    expect(stockStatusColor("LOW_STOCK")).toContain("amber");
    expect(stockStatusColor("HEALTHY")).toContain("emerald");
  });
});
