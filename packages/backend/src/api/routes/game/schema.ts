import type { infer as ZodInfer } from "zod/mini";
import * as z from "zod/mini";
import { apiRequestSchema, apiSuccessResponseSchema } from "../../route-helper";

export const gameSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  participants: z.array(z.uuid()),
  roundCount: z.number().check(z.int(), z.positive()),
  rounds: z.array(z.uuid()),
  createdBy: z.nullable(z.uuid()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const getGameRequestSchema = z.extend(apiRequestSchema, {
  params: z.object({
    id: z.uuid(),
  }),
});

export type GetGameRequest = ZodInfer<typeof getGameRequestSchema>;

export const getGameResponseSchema = z.extend(apiSuccessResponseSchema, {
  game: gameSchema,
});

export type GetGameResponse = ZodInfer<typeof getGameResponseSchema>;

export const listGamesRequestSchema = apiRequestSchema;

export type ListGamesRequest = ZodInfer<typeof listGamesRequestSchema>;

export const listGamesResponseSchema = z.extend(apiSuccessResponseSchema, {
  games: z.array(gameSchema),
});

export type ListGamesResponse = ZodInfer<typeof listGamesResponseSchema>;
