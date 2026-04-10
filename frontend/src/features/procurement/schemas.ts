import { z } from "zod";

export const CreatePOSchema = z.object({
  item_id: z.string().uuid("Material is required."),
  supplier_name: z
    .string()
    .trim()
    .min(2, "Supplier name must be at least 2 characters."),
  ordered_qty: z
    .number()
    .finite("Ordered quantity must be a number.")
    .gt(0, "Ordered quantity must be greater than 0."),
  unit_price: z
    .number()
    .finite("Unit price must be a number.")
    .gt(0, "Unit price must be greater than 0."),
});

export const ReceiveStockSchema = z
  .object({
    po_id: z.string().uuid("Invalid purchase order."),
    remaining_qty: z
      .number()
      .finite("Remaining quantity must be a number.")
      .gt(0, "Remaining quantity must be greater than 0."),
    actual_weight: z
      .number()
      .finite("Actual weight must be a number.")
      .gt(0, "Actual weight must be greater than 0."),
  })
  .superRefine((value, ctx) => {
    if (value.actual_weight > value.remaining_qty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Actual weight cannot exceed remaining quantity.",
        path: ["actual_weight"],
      });
    }
  });

export const VoidReceiptSchema = z.object({
  po_id: z.string().uuid("Invalid purchase order."),
  transaction_id: z.string().uuid("Invalid transaction reference."),
});
