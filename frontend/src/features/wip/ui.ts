import type { WIPLotOption } from "@/features/wip/types";

function toFourDecimals(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.0000";
  }
  return value.toFixed(4);
}

export function getPolishingAutoSku(rawSKU?: string | null): string {
  const sku = (rawSKU ?? "").trim();
  return sku || "Select MWIP batch";
}

export function formatBatchOptionLabel(
  lot: Pick<WIPLotOption, "batch_code" | "remaining_qty" | "remaining_weight">,
): string {
  const qty = lot.remaining_qty || lot.remaining_weight;
  return `${lot.batch_code} (${toFourDecimals(qty)} kg)`;
}
