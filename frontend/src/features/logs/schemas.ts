import { z } from "zod";

export const dailyLogPayloadSchema = z.object({
  source_batch_id: z.string().uuid("Source batch ID must be a valid UUID"),
  output_item_name: z
    .string()
    .trim()
    .min(2, "Output item name must be at least 2 characters")
    .max(120, "Output item name must be at most 120 characters"),
  output_item_specs: z.object({
    thickness: z.number().finite().positive("Thickness must be positive"),
    width: z.number().finite().positive("Width must be positive"),
    coil_weight: z.number().finite().positive("Coil weight must be positive"),
  }),
  input_qty: z.number().finite().positive("Input quantity must be positive"),
  finished_qty: z
    .number()
    .finite()
    .nonnegative("Finished quantity cannot be negative"),
  scrap_qty: z
    .number()
    .finite()
    .nonnegative("Scrap quantity cannot be negative"),
});
