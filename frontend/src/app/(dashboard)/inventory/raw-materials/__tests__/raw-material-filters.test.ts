import { describe, expect, it } from "vitest";
import {
  parseRawMaterialBatchFilters,
  serializeRawMaterialBatchFilters,
} from "@/app/(dashboard)/inventory/raw-materials/raw-material-filters";

describe("raw material batch filters", () => {
  it("parses URL query params into filter state", () => {
    const filters = parseRawMaterialBatchFilters(
      new URLSearchParams("vendor=meow&status=hold&from=2026-05-01&to=2026-05-08&batch=BAT260506"),
    );

    expect(filters).toEqual({
      vendor: "meow",
      status: "HOLD",
      from: "2026-05-01",
      to: "2026-05-08",
      batchCode: "BAT260506",
    });
  });

  it("serializes filter state back into shareable query params", () => {
    const params = serializeRawMaterialBatchFilters({
      vendor: "meow",
      status: "hold",
      from: "2026-05-01",
      to: "2026-05-08",
      batchCode: "BAT260506",
    });

    expect(params.toString()).toBe(
      "vendor=meow&status=HOLD&from=2026-05-01&to=2026-05-08&batch=BAT260506",
    );
  });
});
