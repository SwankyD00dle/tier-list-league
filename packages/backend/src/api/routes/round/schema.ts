import type { infer as ZodInfer } from "zod/mini";
import * as z from "zod/mini";
import { apiRequestSchema, apiSuccessResponseSchema } from "../../route-helper";

export const roundSchema = z.object({
  id: z.uuid(),
  game: z.nullable(z.uuid()),
  roundNumber: z.number().check(z.int(), z.positive()),
  hostedBy: z.nullable(z.uuid()),
  topic: z.string(),
  tierList: z.nullable(z.uuid()),
  guesses: z.array(z.uuid()),
  winningGuess: z.nullable(z.uuid()),
  honorableMentions: z.nullable(z.array(z.uuid())),
  honorableMentionDetails: z.array(
    z.object({
      guessId: z.uuid(),
      title: z.string(),
    }),
  ),
  scoreDeltas: z.record(
    z.uuid(),
    z.object({
      score: z.number().check(z.int(), z.positive()),
      entries: z.array(
        z.object({
          score: z.number().check(z.int(), z.positive()),
          reason: z.string(),
        }),
      ),
    }),
  ),
  participantTierLists: z.nullable(z.array(z.uuid())),
  createdAt: z.iso.datetime(),
  updatedAt: z.nullable(z.iso.datetime()),
  endsAt: z.nullable(z.iso.datetime()),
});

export const getRoundRequestSchema = z.extend(apiRequestSchema, {
  params: z.object({
    id: z.uuid(),
  }),
});

export type GetRoundRequest = ZodInfer<typeof getRoundRequestSchema>;

export const getRoundResponseSchema = z.extend(apiSuccessResponseSchema, {
  round: roundSchema,
});

export type GetRoundResponse = ZodInfer<typeof getRoundResponseSchema>;

export const createRoundRequestSchema = z.extend(apiRequestSchema, {
  params: z.object({
    gameId: z.uuid(),
  }),
  body: z.object({
    topic: z.string().check(z.minLength(1), z.maxLength(500)),
    hostedBy: z.uuid(),
    endsAt: z.optional(z.iso.datetime()),
  }),
});

export type CreateRoundRequest = ZodInfer<typeof createRoundRequestSchema>;

export const createRoundResponseSchema = z.extend(apiSuccessResponseSchema, {
  round: roundSchema,
});

export type CreateRoundResponse = ZodInfer<typeof createRoundResponseSchema>;

export const updateRoundRequestSchema = z.extend(apiRequestSchema, {
  params: z.object({
    id: z.uuid(),
  }),
  body: z.object({
    topic: z.optional(z.string().check(z.minLength(1), z.maxLength(500))),
    hostedBy: z.optional(z.uuid()),
    endsAt: z.optional(z.nullable(z.iso.datetime())),
  }),
});

export type UpdateRoundRequest = ZodInfer<typeof updateRoundRequestSchema>;

export const updateRoundResponseSchema = z.extend(apiSuccessResponseSchema, {
  round: roundSchema,
});

export type UpdateRoundResponse = ZodInfer<typeof updateRoundResponseSchema>;
