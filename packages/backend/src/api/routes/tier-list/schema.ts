import type { infer as ZodInfer } from "zod/mini";
import * as z from "zod/mini";
import { apiRequestSchema, apiSuccessResponseSchema } from "../../route-helper";

const tierIds = z.array(z.uuid());

export const tierListEntrySchema = z.object({
  SS: tierIds,
  S: tierIds,
  A: tierIds,
  B: tierIds,
  C: tierIds,
  D: tierIds,
  E: tierIds,
  F: tierIds,
});

export const tierListSchema = z.object({
  id: z.uuid(),
  createdBy: z.nullable(z.uuid()),
  data: tierListEntrySchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const getTierListRequestSchema = z.extend(apiRequestSchema, {
  params: z.object({
    id: z.uuid(),
  }),
});

export type GetTierListRequest = ZodInfer<typeof getTierListRequestSchema>;

export const getTierListResponseSchema = z.extend(apiSuccessResponseSchema, {
  tierList: tierListSchema,
});

export type GetTierListResponse = ZodInfer<typeof getTierListResponseSchema>;
