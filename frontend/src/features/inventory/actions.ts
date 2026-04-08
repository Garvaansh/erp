"use server";

import { revalidatePath } from "next/cache";
import {
  createItemDefinition,
  getRawItemById,
  receiveStock,
} from "@/features/inventory/api";
import {
  defineMaterialSchema,
  receiveStockCommandSchema,
} from "@/features/inventory/schemas";
import { submitDailyLog } from "@/features/logs/api";
import type {
  DefineMaterialInput,
  InventoryActionState,
  LogProductionInput,
  ReceiveStockCommandInput,
} from "@/features/inventory/types";

const DEFAULT_ACTION_STATE: InventoryActionState = {
  ok: false,
  message: "",
};

function sanitizeSkuToken(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "");
}

function normalizeDimension(value: number): string {
  const fixed = value
    .toFixed(4)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
  return fixed.replace(".", "-");
}

function buildRawSku(thickness: number, width: number, grade: string): string {
  const thicknessToken = normalizeDimension(thickness);
  const widthToken = normalizeDimension(width);
  const gradeToken = sanitizeSkuToken(grade) || "STD";

  return `RAW-SS-${thicknessToken}x${widthToken}-${gradeToken}`;
}

function buildBatchCode(sku: string): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear());

  return `${sanitizeSkuToken(sku) || "RAW-SS"}-${day}-${month}-${year}`;
}

async function receiveStockCommand(
  payload: ReceiveStockCommandInput,
): Promise<InventoryActionState> {
  try {
    const parsed = receiveStockCommandSchema.parse(payload);

    let batchCode = (parsed.batch_code ?? "").trim();
    if (!batchCode) {
      const item = await getRawItemById(parsed.item_id);
      const sku = item?.sku?.trim() || "RAW-SS";
      batchCode = buildBatchCode(sku);
    }

    await receiveStock({
      item_id: parsed.item_id,
      batch_code: batchCode,
      quantity: parsed.weight,
      unit_cost: parsed.price,
      reference_type: "PURCHASE_RECEIPT",
      reference_id: crypto.randomUUID(),
    });

    revalidatePath("/inventory");

    return {
      ok: true,
      message: "Stock received successfully.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Failed to receive stock.",
    };
  }
}

export async function defineAndReceiveAction(
  payload: DefineMaterialInput,
): Promise<InventoryActionState> {
  try {
    const parsed = defineMaterialSchema.parse(payload);
    const sku = buildRawSku(parsed.thickness, parsed.width, parsed.grade);

    await createItemDefinition({
      name: parsed.name,
      sku,
      category: "RAW",
      base_unit: "WEIGHT",
      specs: {
        thickness: parsed.thickness,
        width: parsed.width,
        grade: parsed.grade.trim(),
        coil_weight: 1,
      },
    });

    revalidatePath("/inventory");

    return {
      ok: true,
      message: "Raw material defined successfully.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Failed to define material.",
    };
  }
}

export async function receiveStockAction(
  payload: ReceiveStockCommandInput,
): Promise<InventoryActionState> {
  return receiveStockCommand(payload);
}

export async function receiveStockFormAction(
  _previousState: InventoryActionState = DEFAULT_ACTION_STATE,
  formData: FormData,
): Promise<InventoryActionState> {
  void _previousState;

  return receiveStockCommand({
    item_id: String(formData.get("item_id") ?? "").trim(),
    batch_code: String(formData.get("batch_code") ?? "").trim(),
    weight: Number(formData.get("quantity") ?? 0),
    price: Number(formData.get("unit_cost") ?? 0),
  });
}

export async function logProductionAction(
  payload: LogProductionInput,
): Promise<InventoryActionState> {
  try {
    const result = await submitDailyLog(payload);
    revalidatePath("/inventory");

    return {
      ok: result.success,
      message: result.success
        ? `Production logged. journal_id: ${result.journal_id}`
        : "Production logging failed.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Failed to log production.",
    };
  }
}
