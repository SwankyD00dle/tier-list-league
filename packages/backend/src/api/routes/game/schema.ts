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

export const createGameBodySchema = z.object({
  name: z.string().check(z.minLength(1), z.maxLength(200)),
  description: z.string().check(z.maxLength(2000)),
  roundCount: z.number().check(z.int(), z.positive()),
  createdBy: z.uuid(),
  participants: z.array(z.uuid()),
});

export const createGameRequestSchema = z.extend(apiRequestSchema, {
  body: createGameBodySchema,
});

export type CreateGameRequest = ZodInfer<typeof createGameRequestSchema>;

export const createGameResponseSchema = z.extend(apiSuccessResponseSchema, {
  game: gameSchema,
});

export type CreateGameResponse = ZodInfer<typeof createGameResponseSchema>;

export const updateGameBodySchema = z.object({
  name: z.optional(z.string().check(z.minLength(1), z.maxLength(200))),
  description: z.optional(z.string().check(z.maxLength(2000))),
  roundCount: z.optional(z.number().check(z.int(), z.positive())),
});

export const updateGameRequestSchema = z.extend(apiRequestSchema, {
  params: z.object({
    id: z.uuid(),
  }),
  body: updateGameBodySchema,
});

export type UpdateGameRequest = ZodInfer<typeof updateGameRequestSchema>;

export const updateGameResponseSchema = z.extend(apiSuccessResponseSchema, {
  game: gameSchema,
});

export type UpdateGameResponse = ZodInfer<typeof updateGameResponseSchema>;
