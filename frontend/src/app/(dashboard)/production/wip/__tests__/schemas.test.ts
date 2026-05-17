import { describe, it, expect } from "vitest";
import { moldingFormSchema, polishingFormSchema } from "../schemas";

describe("WIP Mass Balance Schemas", () => {
  describe("Molding Schema", () => {
    it("accepts valid mass balance", () => {
      const data = {
        output_item_id: "123e4567-e89b-12d3-a456-426614174000",
        input_qty: 100,
        output_qty: 90,
        scrap_qty: 5,
        shortlength_qty: 5,
        notes: "",
      };
      
      const result = moldingFormSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("rejects invalid mass balance", () => {
      const data = {
        output_item_id: "123e4567-e89b-12d3-a456-426614174000",
        input_qty: 100,
        output_qty: 90,
        scrap_qty: 5,
        shortlength_qty: 0, // Missing 5kg
        notes: "",
      };
      
      const result = moldingFormSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Mass balance error");
        expect(result.error.issues[0].path).toEqual(["input_qty"]);
      }
    });

    it("accepts floats", () => {
      const data = {
        output_item_id: "123e4567-e89b-12d3-a456-426614174000",
        input_qty: 100.005,
        output_qty: 90.005,
        scrap_qty: 5.0,
        shortlength_qty: 5.0,
        notes: "",
      };
      
      const result = moldingFormSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("Polishing Schema", () => {
    it("accepts valid mass balance", () => {
      const data = {
        output_item_id: "123e4567-e89b-12d3-a456-426614174000",
        input_qty: 50,
        output_qty: 48,
        scrap_qty: 1,
        shortlength_qty: 1,
        notes: "test note",
      };
      
      const result = polishingFormSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("rejects invalid mass balance", () => {
      const data = {
        output_item_id: "123e4567-e89b-12d3-a456-426614174000",
        input_qty: 50,
        output_qty: 48,
        scrap_qty: 1,
        shortlength_qty: 2, // Over by 1kg
        notes: "",
      };
      
      const result = polishingFormSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Mass balance error");
      }
    });
  });
});
