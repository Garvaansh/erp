import { z } from "zod";

// ─── Shared primitives ───────────────────────────────────────────────────────

const positiveQty = z
  .number()
  .positive("Must be greater than 0")
  .finite();

const nonNegativeQty = z
  .number()
  .min(0, "Cannot be negative")
  .finite();

const noteField = z.string().trim().max(500).optional();

// ─── Mass-balance refinement ─────────────────────────────────────────────────

/**
 * Validates: input_qty === output_qty + scrap_qty + shortlength_qty
 * This is a UX-only guard. Backend validation is authoritative.
 * Error is attached to the `input_qty` field so Shadcn FormMessage renders inline.
 */
function refineMassBalance<
  T extends {
    input_qty: number;
    output_qty: number;
    scrap_qty: number;
    shortlength_qty: number;
  },
>(data: T, ctx: z.RefinementCtx) {
  const expected = data.output_qty + data.scrap_qty + data.shortlength_qty;
  const diff = Math.abs(data.input_qty - expected);
  if (diff > 0.0001) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["input_qty"],
      message: `Mass balance error: input (${data.input_qty}) ≠ output + scrap + shortlength (${expected.toFixed(4)})`,
    });
  }
}

// ─── Molding form schema ─────────────────────────────────────────────────────

export const moldingFormSchema = z
  .object({
    output_item_id: z.string().uuid("Please select a finished good"),
    input_qty: positiveQty,
    output_qty: positiveQty,
    scrap_qty: nonNegativeQty,
    shortlength_qty: nonNegativeQty,
    notes: noteField,
  })
  .superRefine(refineMassBalance);

export type MoldingFormValues = z.infer<typeof moldingFormSchema>;

// ─── Polishing form schema ───────────────────────────────────────────────────

export const polishingFormSchema = z
  .object({
    output_item_id: z.string().uuid("Please select a finished good"),
    input_qty: positiveQty,
    output_qty: positiveQty,
    scrap_qty: nonNegativeQty,
    shortlength_qty: nonNegativeQty,
    notes: noteField,
  })
  .superRefine(refineMassBalance);

export type PolishingFormValues = z.infer<typeof polishingFormSchema>;
