"use server";

import { revalidatePath } from "next/cache";
import { submitDailyLog } from "@/features/logs/api";
import type { DailyLogActionState } from "@/features/logs/types";

const DEFAULT_ACTION_STATE: DailyLogActionState = {
  ok: false,
  message: "",
};

export async function submitDailyLogAction(
  _previousState: DailyLogActionState = DEFAULT_ACTION_STATE,
  formData: FormData,
): Promise<DailyLogActionState> {
  try {
    const result = await submitDailyLog({
      source_batch_id: String(formData.get("source_batch_id") ?? "").trim(),
      output_item_name: String(formData.get("output_item_name") ?? "").trim(),
      output_item_specs: {
        thickness: Number(formData.get("output_specs_thickness") ?? 0),
        width: Number(formData.get("output_specs_width") ?? 0),
        grade: String(formData.get("output_specs_grade") ?? "").trim(),
        coil_weight: Number(formData.get("output_specs_coil_weight") ?? 0),
      },
      input_qty: Number(formData.get("input_qty") ?? 0),
      finished_qty: Number(formData.get("finished_qty") ?? 0),
      scrap_qty: Number(formData.get("scrap_qty") ?? 0),
    });

    revalidatePath("/logs");

    return {
      ok: result.success,
      message: result.success
        ? `Daily log submitted. journal_id: ${result.journal_id}`
        : "Daily log request failed.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Failed to submit daily log.",
    };
  }
}
