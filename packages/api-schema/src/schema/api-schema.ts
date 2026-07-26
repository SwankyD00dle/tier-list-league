import type { infer as ZodInfer } from "zod/mini";
import * as z from "zod/mini";

export const apiRequestSchema = z.object({
  params: z.optional(z.record(z.string(), z.string())),
  query: z.optional(z.record(z.string(), z.union([z.string(), z.array(z.string())]))),
  body: z.optional(z.unknown()),
  headers: z.optional(z.record(z.string(), z.union([z.string(), z.array(z.string())]))),
});

export type ApiRequest = ZodInfer<typeof apiRequestSchema>;

export const apiSuccessResponseSchema = z.object({
  ok: z.literal(true),
});

export type ApiSuccessResponse = ZodInfer<typeof apiSuccessResponseSchema>;

export const apiErrorResponseSchema = z.object({
  ok: z.literal(false),
  code: z.string(),
  message: z.string(),
  details: z.optional(z.unknown()),
});

export type ApiErrorResponse = ZodInfer<typeof apiErrorResponseSchema>;
