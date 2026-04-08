import { apiClient } from "@/lib/api-client";
import { dailyLogPayloadSchema } from "@/features/logs/schemas";
import type { DailyLogPayload, DailyLogResult } from "@/features/logs/types";

export async function submitDailyLog(
  payload: DailyLogPayload,
): Promise<DailyLogResult> {
  const parsed = dailyLogPayloadSchema.parse(payload);

  const data = await apiClient<DailyLogResult>("/logs", {
    method: "POST",
    headers: {
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(parsed),
  });

  return data;
}
