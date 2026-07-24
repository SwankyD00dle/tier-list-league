import type { infer as ZodInfer } from "zod/mini";
import * as z from "zod/mini";
import { apiRequestSchema } from "../../route-helper";

export const healthRequestSchema = apiRequestSchema;

export type HealthRequest = ZodInfer<typeof healthRequestSchema>;

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "db_unavailable"]),
});

export type HealthResponse = ZodInfer<typeof healthResponseSchema>;
