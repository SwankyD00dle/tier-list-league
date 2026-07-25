import type { infer as ZodInfer } from "zod/mini";
import * as z from "zod/mini";
import { apiRequestSchema, apiSuccessResponseSchema } from "../../../route-helper";

export const guessSchema = z.object({
  id: z.uuid(),
  round: z.nullable(z.uuid()),
  data: z.string(),
  createdBy: z.nullable(z.uuid()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const submitGuessRequestSchema = z.extend(apiRequestSchema, {
  params: z.object({
    roundId: z.uuid(),
  }),
  body: z.object({
    userId: z.uuid(),
    data: z.string().check(z.minLength(1), z.maxLength(2000)),
  }),
});

export type SubmitGuessRequest = ZodInfer<typeof submitGuessRequestSchema>;

export const submitGuessResponseSchema = z.extend(apiSuccessResponseSchema, {
  guess: guessSchema,
});

export type SubmitGuessResponse = ZodInfer<typeof submitGuessResponseSchema>;
