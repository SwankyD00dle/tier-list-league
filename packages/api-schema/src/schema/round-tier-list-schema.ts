import type { infer as ZodInfer } from "zod/mini";
import * as z from "zod/mini";
import { apiRequestSchema, apiSuccessResponseSchema } from "./api-schema";

export const tierListDataSchema = z.object({
  SS: z.array(z.string()),
  S: z.array(z.string()),
  A: z.array(z.string()),
  B: z.array(z.string()),
  C: z.array(z.string()),
  D: z.array(z.string()),
  E: z.array(z.string()),
  F: z.array(z.string()),
});

export const submitTierListRequestSchema = z.extend(apiRequestSchema, {
  params: z.object({
    roundId: z.uuid(),
  }),
  body: z.object({
    userId: z.uuid(),
    data: tierListDataSchema,
  }),
});

export type SubmitTierListRequest = ZodInfer<typeof submitTierListRequestSchema>;

export const submitTierListResponseSchema = z.extend(apiSuccessResponseSchema, {
  tierList: z.object({
    id: z.uuid(),
    createdBy: z.nullable(z.uuid()),
    data: tierListDataSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
  role: z.union([z.literal("host"), z.literal("participant")]),
});

export type SubmitTierListResponse = ZodInfer<typeof submitTierListResponseSchema>;
