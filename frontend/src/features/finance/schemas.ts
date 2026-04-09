import { z } from "zod";

export const financeFilterSchema = z.object({
  period: z.string().trim().optional(),
});
