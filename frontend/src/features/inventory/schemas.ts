import { z } from "zod";

const printableAsciiSchema = z
  .string()
  .regex(/^[\x20-\x7E]+$/, "Must contain printable ASCII characters only");

export const defineMaterialSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  thickness: z.number().finite().gt(0, "Thickness must be greater than 0"),
  width: z.number().finite().gt(0, "Width must be greater than 0"),
  grade: printableAsciiSchema
    .trim()
    .min(2, "Grade must be at least 2 characters")
    .max(40, "Grade must be at most 40 characters"),
});

export const receiveStockCommandSchema = z.object({
  item_id: z.string().uuid("Item ID must be a valid UUID"),
  batch_code: printableAsciiSchema
    .trim()
    .min(2, "Batch code must be at least 2 characters")
    .max(64, "Batch code must be at most 64 characters")
    .optional()
    .or(z.literal("")),
  weight: z.number().finite().positive("Weight must be greater than 0"),
  price: z.number().finite().positive("Price must be greater than 0"),
});

export const receiveStockPayloadSchema = z.object({
  item_id: z.string().uuid("Item ID must be a valid UUID"),
  batch_code: z
    .string()
    .trim()
    .min(2, "Batch code must be at least 2 characters")
    .max(64, "Batch code must be at most 64 characters"),
  quantity: z.number().finite().positive("Quantity must be greater than 0"),
  unit_cost: z.number().finite().positive("Unit cost must be greater than 0"),
  reference_type: z.union(
    [
      z.literal("PURCHASE_RECEIPT"),
      z.literal("PRODUCTION_JOURNAL"),
      z.literal("TRANSFER"),
      z.literal("ADJUSTMENT"),
    ],
    { message: "Invalid reference type" },
  ),
  reference_id: z.string().uuid("Reference ID must be a valid UUID"),
  notes: z.string().trim().max(500).optional(),
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

export const steelSpecsSchema = z.object({
  thickness: z.number().finite().gt(0, "Thickness must be greater than 0"),
  width: z.number().finite().gt(0, "Width must be greater than 0"),
  grade: printableAsciiSchema
    .trim()
    .min(2, "Grade must be at least 2 characters")
    .max(40, "Grade must be at most 40 characters"),
  coil_weight: z.number().finite().gt(0, "Coil weight must be greater than 0"),
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
  is_active: z.boolean(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const createItemDefinitionInputSchema = z.object({
  parent_id: z.string().uuid("Parent ID must be a valid UUID").optional(),
  sku: printableAsciiSchema
    .trim()
    .min(2, "SKU must be at least 2 characters")
    .max(64, "SKU must be at most 64 characters"),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  category: itemCategorySchema,
  base_unit: baseUnitSchema,
  specs: steelSpecsSchema,
});

export const selectableItemSchema = z.object({
  item_id: z.string().uuid("Item ID must be a valid UUID"),
  label: z.string().trim().min(1),
  category: itemCategorySchema,
});

export const itemDefinitionsSchema = z.array(itemDefinitionSchema);
export const selectableItemsSchema = z.array(selectableItemSchema);
