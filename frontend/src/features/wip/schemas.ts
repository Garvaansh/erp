import { z } from "zod";

const decimalStringSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,4})?$/, "Must be a positive decimal with up to 4 places");

const noteSchema = z.string().trim().max(500).optional();

export const moldingPayloadSchema = z.object({
  source_batch_id: z.string().uuid("source_batch_id must be a valid UUID"),
  input_weight: decimalStringSchema,
  molded_output: decimalStringSchema,
  scrap_qty: decimalStringSchema,
  shortlength_qty: decimalStringSchema,
  process_loss_qty: decimalStringSchema,
  diameter: decimalStringSchema,
  note: noteSchema,
});

export const polishingPayloadSchema = z.object({
  source_batch_id: z.string().uuid("source_batch_id must be a valid UUID"),
  molded_input: decimalStringSchema,
  finished_output: decimalStringSchema,
  polishing_scrap_qty: decimalStringSchema,
  polishing_shortlength_qty: decimalStringSchema,
  final_adjustment_qty: decimalStringSchema,
  note: noteSchema,
});

export const pendingNoteSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export const pendingApprovalSchema = z.object({
  journal_id: z.string().uuid(),
  movement_group_id: z.string().uuid(),
  source_batch_id: z.string().uuid(),
  source_batch_code: z.string().trim().min(1),
  source_batch_type: z.string().trim().min(1),
  input_weight: decimalStringSchema,
  expected_total: decimalStringSchema,
  difference: decimalStringSchema,
  tolerance: decimalStringSchema,
  note: z.string(),
  created_at: z.string(),
  created_by: z.string().uuid(),
});

export const pendingApprovalListSchema = z.array(pendingApprovalSchema);

export const wipActivityEntrySchema = z.object({
  journal_id: z.string().uuid(),
  created_at: z.string().trim().min(1),
  batch_code: z.string().trim().min(1),
  item_sku: z.string(),
  item_name: z.string(),
  workstation: z.enum(["MOLDING", "POLISHING", "UNKNOWN"]),
  input_qty: decimalStringSchema,
  output_qty: decimalStringSchema,
  scrap_qty: decimalStringSchema,
  short_qty: decimalStringSchema,
  difference: z
    .string()
    .trim()
    .regex(/^-?\d+(\.\d{1,4})?$/),
  status: z.enum(["BALANCED", "TOLERANCE", "FLAGGED"]),
  approval_state: z.enum(["FINAL", "PENDING_APPROVAL", "REJECTED"]),
  operator_name: z.string(),
});

export const wipActivityEntryListSchema = z.array(wipActivityEntrySchema);
