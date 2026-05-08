"use server";

import { revalidatePath } from "next/cache";
import { createItemDefinition, receiveStock, updateItemThreshold } from "@/lib/api/inventory";
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

async function receiveStockCommand(
  payload: ReceiveStockCommandInput,
): Promise<InventoryActionState> {
  try {
    const parsed = receiveStockCommandSchema.parse(payload);

    await receiveStock({
      item_id: parsed.item_id,
      quantity: parsed.weight,
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

/**
 * Creates a raw material definition from the Add Raw Material form.
 * The final payload to the backend uses normalized _mm keys.
 * Backend auto-generates SKU and category_code.
 */
export async function defineAndReceiveAction(
  payload: DefineMaterialInput,
): Promise<InventoryActionState> {
  try {
    const parsed = defineMaterialSchema.parse(payload);

    const item = await createItemDefinition({
      name: parsed.name,
      category: "RAW",
      base_unit: "WEIGHT",
      specs: {
        thickness_mm: parsed.thickness_mm,
        width_mm: parsed.width_mm,
      },
      low_stock_threshold: parsed.low_stock_threshold,
    });

    if (!item) {
      return { ok: false, message: "Service unavailable." };
    }

    // If threshold was provided, persist it via the threshold endpoint
    if (parsed.low_stock_threshold > 0) {
      try {
        await updateItemThreshold(item.id, parsed.low_stock_threshold);
      } catch {
        // Material created, threshold update failed — log but don't block
      }
    }

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
    weight: Number(formData.get("quantity") ?? 0),
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
        ? "Production logged successfully."
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
