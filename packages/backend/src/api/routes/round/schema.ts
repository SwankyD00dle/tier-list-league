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
