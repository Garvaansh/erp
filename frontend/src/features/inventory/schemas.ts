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

export const selectableItemSchema = z.object({
  item_id: z.string().uuid("Item ID must be a valid UUID"),
  label: z.string().trim().min(1),
  category: itemCategorySchema,
});

export const itemDefinitionsSchema = z.array(itemDefinitionSchema);
export const selectableItemsSchema = z.array(selectableItemSchema);
