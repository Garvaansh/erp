import { z } from "zod";

export const hrFilterSchema = z.object({
  team: z.string().trim().optional(),
});
