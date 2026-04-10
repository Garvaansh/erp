"use server";

import { revalidatePath } from "next/cache";
import { apiClient } from "@/lib/api-client";
import {
  CreatePOSchema,
  ReceiveStockSchema,
  VoidReceiptSchema,
} from "@/features/procurement/schemas";
import type {
  CreatePOInput,
  CreatePOResult,
  ProcurementActionResult,
  ReceiveStockInput,
  ReceiveStockResult,
  VoidReceiptResult,
} from "@/features/procurement/types";

export async function createPOAction(
  data: CreatePOInput,
): Promise<ProcurementActionResult<CreatePOResult>> {
  try {
    const parsed = CreatePOSchema.parse(data);

    const result = await apiClient<CreatePOResult>("/procurement/orders", {
      method: "POST",
      body: JSON.stringify(parsed),
    });

    revalidatePath("/procurement");

    return {
      ok: true,
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to create purchase order.",
    };
  }
}

export async function receiveStockAction(
  data: ReceiveStockInput,
): Promise<ProcurementActionResult<ReceiveStockResult>> {
  try {
    const parsed = ReceiveStockSchema.parse(data);

    const result = await apiClient<ReceiveStockResult>("/procurement/receive", {
      method: "POST",
      body: JSON.stringify({
        po_id: parsed.po_id,
        actual_weight_received: parsed.actual_weight,
      }),
    });

    revalidatePath("/procurement");
    revalidatePath(`/procurement/${parsed.po_id}`);

    return {
      ok: true,
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to receive stock for this order.",
    };
  }
}

export async function voidReceiptAction(
  transactionId: string,
  poId: string,
): Promise<ProcurementActionResult<VoidReceiptResult>> {
  try {
    const parsed = VoidReceiptSchema.parse({
      po_id: poId,
      transaction_id: transactionId,
    });

    const result = await apiClient<VoidReceiptResult>(
      "/procurement/void-receipt",
      {
        method: "POST",
        body: JSON.stringify(parsed),
      },
    );

    revalidatePath("/procurement");
    revalidatePath(`/procurement/${parsed.po_id}`);

    return {
      ok: true,
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to void receipt.",
    };
  }
}
