import type { infer as ZodInfer } from "zod/mini";
import * as z from "zod/mini";
import { apiRequestSchema, apiSuccessResponseSchema } from "../../../route-helper";

export const scoreEntrySchema = z.object({
  score: z.number().check(z.int(), z.positive()),
  reason: z.string(),
});

export const playerRoundScoreSchema = z.object({
  score: z.number().check(z.int(), z.positive()),
  entries: z.array(scoreEntrySchema),
});

export const playerScoreSchema = z.object({
  total: z.number().check(z.int(), z.nonnegative()),
  rounds: z.record(z.uuid(), playerRoundScoreSchema),
});

export type PlayerScore = ZodInfer<typeof playerScoreSchema>;

export const gameScoresSchema = z.record(z.uuid(), playerScoreSchema);

export type GameScores = ZodInfer<typeof gameScoresSchema>;

export const honorableMentionInputSchema = z.object({
  guessId: z.uuid(),
  title: z.string().check(z.minLength(1), z.maxLength(200)),
});

export const scoreRoundInputSchema = z.object({
  id: z.uuid(),
  hostedBy: z.uuid(),
  winningGuess: z.uuid(),
  honorableMentions: z.array(honorableMentionInputSchema),
});

export const recordGameScoreRequestSchema = z.extend(apiRequestSchema, {
  params: z.object({
    gameId: z.uuid(),
  }),
  body: z.object({
    round: scoreRoundInputSchema,
  }),
});

export type RecordGameScoreRequest = ZodInfer<typeof recordGameScoreRequestSchema>;

export const honorableMentionSchema = z.object({
  guessId: z.uuid(),
  title: z.string(),
});

export const recordedRoundScoreSchema = z.object({
  id: z.uuid(),
  winningGuess: z.uuid(),
  honorableMentions: z.array(honorableMentionSchema),
  scoreDeltas: z.record(z.uuid(), playerRoundScoreSchema),
});

export const recordGameScoreResponseSchema = z.extend(apiSuccessResponseSchema, {
  round: recordedRoundScoreSchema,
  scores: gameScoresSchema,
});

export type RecordGameScoreResponse = ZodInfer<typeof recordGameScoreResponseSchema>;

export const getGameScoresRequestSchema = z.extend(apiRequestSchema, {
  params: z.object({
    gameId: z.uuid(),
  }),
});

export const getGameScoresResponseSchema = z.extend(apiSuccessResponseSchema, {
  scores: gameScoresSchema,
});

export type GetGameScoresResponse = ZodInfer<typeof getGameScoresResponseSchema>;

export const getUserGameScoreRequestSchema = z.extend(apiRequestSchema, {
  params: z.object({
    gameId: z.uuid(),
    userId: z.uuid(),
  }),
});

export const getUserGameScoreResponseSchema = z.extend(apiSuccessResponseSchema, {
  userId: z.uuid(),
  score: playerScoreSchema,
});

export type GetUserGameScoreResponse = ZodInfer<typeof getUserGameScoreResponseSchema>;
