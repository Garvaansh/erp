import { z } from "zod";

const printableAsciiSchema = z
  .string()
  .regex(/^[\x20-\x7E]+$/, "Must contain printable ASCII characters only");

/**
 * Schema for the Add Raw Material form.
 * Only operational fields — no SKU, no category_code, no internal identifiers.
 */
export const defineMaterialSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  thickness_mm: z.number().finite().gt(0, "Thickness must be greater than 0"),
  width_mm: z.number().finite().gt(0, "Width must be greater than 0"),
  low_stock_threshold: z
    .number()
    .finite()
    .gte(0, "Threshold cannot be negative")
    .default(0),
});

export const receiveStockCommandSchema = z.object({
  item_id: z.string().uuid("Item ID must be a valid UUID"),
  weight: z.number().finite().positive("Weight must be greater than 0"),
});

export const receiveStockPayloadSchema = z.object({
  item_id: z.string().uuid("Item ID must be a valid UUID"),
  quantity: z.number().finite().positive("Quantity must be greater than 0"),
});

export const itemCategorySchema = z.union(
  [
    z.literal("RAW"),
    z.literal("SEMI_FINISHED"),
    z.literal("FINISHED"),
    z.literal("SCRAP"),
  ],
  { message: "Invalid item category" },
);

export const baseUnitSchema = z.union(
  [z.literal("WEIGHT"), z.literal("COUNT"), z.literal("LENGTH")],
  { message: "Invalid base unit" },
);

/**
 * Normalized specs schema — no coil_weight.
 * thickness/width accepted as either legacy or _mm suffixed keys.
 */
export const steelSpecsSchema = z.object({
  thickness: z
    .number()
    .finite()
    .gt(0, "Thickness must be greater than 0")
    .optional(),
  width: z.number().finite().gt(0, "Width must be greater than 0").optional(),
  thickness_mm: z
    .number()
    .finite()
    .gt(0, "Thickness must be greater than 0")
    .optional(),
  width_mm: z
    .number()
    .finite()
    .gt(0, "Width must be greater than 0")
    .optional(),
  diameter: z
    .number()
    .finite()
    .gt(0, "Diameter must be greater than 0")
    .optional(),
  grade: z.string().max(32).optional(),
});

export const itemDefinitionSchema = z.object({
  id: z.string().uuid("Item ID must be a valid UUID"),
  parent_id: z.string().uuid("Parent ID must be a valid UUID").optional(),
  sku: printableAsciiSchema
    .trim()
    .min(2, "SKU must be at least 2 characters")
    .max(64, "SKU must be at most 64 characters")
    .optional(),
  name: z.string().trim().min(2).max(120),
  category: itemCategorySchema,
  base_unit: baseUnitSchema,
  specs: steelSpecsSchema,
  specification: z.string().optional(),
  low_stock_threshold: z.number().optional(),
  is_active: z.boolean(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const createItemDefinitionInputSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  category: itemCategorySchema,
  base_unit: baseUnitSchema,
  specs: steelSpecsSchema,
  low_stock_threshold: z.number().finite().gte(0).optional(),
});

export const createFinishedGoodInputSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  linked_raw_material_id: z.string().uuid("Raw material ID must be a valid UUID"),
  diameter: z.number().finite().gt(0, "Diameter must be greater than 0"),
  low_stock_threshold: z.number().finite().gte(0).optional(),
});

export const selectableItemSchema = z.object({
  item_id: z.string().uuid("Item ID must be a valid UUID"),
  label: z.string().trim().min(1),
  category: itemCategorySchema,
});

export const itemDefinitionsSchema = z.array(itemDefinitionSchema);
export const selectableItemsSchema = z.array(selectableItemSchema);

export const finishedGoodStatusSchema = z.union([
  z.literal("OK"),
  z.literal("LOW"),
  z.literal("OUT"),
]);

export const finishedGoodMasterRowSchema = z.object({
  item_id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  diameter: z.number(),
  available_qty: z.number(),
  reserved_qty: z.number(),
  status: finishedGoodStatusSchema,
});

export const finishedGoodBatchRowSchema = z.object({
  batch_id: z.string().uuid(),
  batch_code: z.string(),
  created_at: z.string(),
  initial_qty: z.number(),
  remaining_qty: z.number(),
  reserved_qty: z.number(),
  available_qty: z.number(),
  status: z.union([
    z.literal("ACTIVE"),
    z.literal("HOLD"),
    z.literal("EXHAUSTED"),
    z.literal("REVERSED"),
  ]),
  source_molded_batch_id: z.string().uuid().optional(),
  source_molded_batch_code: z.string().optional(),
});

export const finishedGoodRecentPolishingRowSchema = z.object({
  journal_id: z.string().uuid(),
  created_at: z.string(),
  finished_batch_id: z.string().uuid(),
  finished_batch_code: z.string(),
  source_molded_batch_id: z.string().uuid().optional(),
  source_molded_batch_code: z.string().optional(),
  output_qty: z.string(),
  scrap_qty: z.string(),
  shortlength_qty: z.string(),
  process_loss_qty: z.string(),
  operator_name: z.string().optional(),
});

export const finishedGoodLineageBatchRowSchema = z.object({
  batch_id: z.string().uuid(),
  batch_code: z.string(),
  created_at: z.string(),
  status: z.union([
    z.literal("ACTIVE"),
    z.literal("HOLD"),
    z.literal("EXHAUSTED"),
    z.literal("REVERSED"),
  ]),
  available_qty: z.number(),
  produced_qty: z.number().optional(),
  latest_used_at: z.string().optional(),
  vendor_name: z.string().optional(),
  po_number: z.string().optional(),
});

export const finishedGoodSummarySchema = z.object({
  item_id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  diameter: z.number(),
  total_qty: z.number(),
  available_qty: z.number(),
  reserved_qty: z.number(),
  hold_qty: z.number(),
  status: finishedGoodStatusSchema,
  batch_count: z.number(),
  linked_raw_material_id: z.string().uuid().optional(),
  linked_raw_material_sku: z.string().optional(),
  linked_raw_material_name: z.string().optional(),
  linked_raw_material_specification: z.string().optional(),
});

export const finishedGoodDetailSchema = z.object({
  summary: finishedGoodSummarySchema,
  batches: z.array(finishedGoodBatchRowSchema),
  recent_polishing_output: z.array(finishedGoodRecentPolishingRowSchema),
  source_molded_batches: z.array(finishedGoodLineageBatchRowSchema),
  source_raw_batches: z.array(finishedGoodLineageBatchRowSchema),
});
