import { z } from "zod";

export const orderLineSchema = z.object({
  key: z.string().min(1),
  finished_good_item_id: z.string().uuid("Select a finished good."),
  ordered_qty: z.number().gt(0, "Quantity must be greater than zero."),
  unit_price: z.number().min(0, "Unit price cannot be negative."),
});

export const orderDraftFormSchema = z.object({
  notes: z.string().max(1000),
  lines: z.array(orderLineSchema).min(1, "Add at least one order line."),
});

export const draftCustomerSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(2, "Customer name is required.")
    .max(255),
  phone_number: z.string().trim().max(30),
  gst_number: z.string().trim().max(30),
});

export const dispatchLineSchema = z.object({
  sales_order_line_id: z.string().uuid(),
  dispatch_qty: z.number().min(0, "Dispatch quantity cannot be negative."),
});

export const dispatchOrderSchema = z
  .object({
    notes: z.string().max(1000),
    lines: z.array(dispatchLineSchema),
  })
  .superRefine((value, ctx) => {
    if (!value.lines.some((line) => line.dispatch_qty > 0)) {
      ctx.addIssue({
        code: "custom",
        message: "Enter at least one dispatch quantity greater than zero.",
        path: ["lines"],
      });
    }
  });

export const cancelOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Cancellation reason is required.")
    .max(500),
});

export type OrderDraftFormValues = z.infer<typeof orderDraftFormSchema>;
export type DraftCustomerValues = z.infer<typeof draftCustomerSchema>;
export type DispatchOrderValues = z.infer<typeof dispatchOrderSchema>;
export type CancelOrderValues = z.infer<typeof cancelOrderSchema>;
