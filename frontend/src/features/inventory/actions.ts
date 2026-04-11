"use server";

import { revalidatePath } from "next/cache";
import { createItemDefinition, receiveStock } from "@/features/inventory/api";
import {
  defineMaterialSchema,
  receiveStockCommandSchema,
} from "@/features/inventory/schemas";
import { submitDailyLog } from "@/features/logs/api";
import type {
  DefineMaterialInput,
  InventoryActionState,
  ItemCategory,
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

export async function defineAndReceiveAction(
  payload: DefineMaterialInput,
): Promise<InventoryActionState> {
  try {
    const parsed = defineMaterialSchema.parse(payload);

    await createItemDefinition({
      name: parsed.name,
      category: "RAW",
      base_unit: "WEIGHT",
      specs: {
        thickness: parsed.thickness,
        width: parsed.width,
        diameter: parsed.diameter,
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
    weight: Number(formData.get("quantity") ?? 0),
  });
}

export async function createItemFormAction(
  _previousState: InventoryActionState = DEFAULT_ACTION_STATE,
  formData: FormData,
): Promise<InventoryActionState> {
  void _previousState;

  try {
    const itemType = String(formData.get("item_type") ?? "COIL").toUpperCase();
    const category: ItemCategory = itemType === "COIL" ? "RAW" : "FINISHED";

    await createItemDefinition({
      name: String(formData.get("name") ?? "").trim(),
      category,
      base_unit: "WEIGHT",
      specs: {
        thickness: Number(formData.get("thickness") ?? 0) || 0,
        width: Number(formData.get("width") ?? 0) || 0,
        coil_weight: Number(formData.get("coil_weight") ?? 0) || 0,
      },
    });

    revalidatePath("/inventory");

    return {
      ok: true,
      message: "Item created successfully.",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Service unavailable.",
    };
  }
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
