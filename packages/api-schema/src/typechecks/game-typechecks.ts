import {
  type CreateGameRequest,
  type CreateGameResponse,
  createGameRequestSchema,
  createGameResponseSchema,
  type GetGameRequest,
  type GetGameResponse,
  getGameRequestSchema,
  getGameResponseSchema,
  type ListGamesRequest,
  type ListGamesResponse,
  listGamesRequestSchema,
  listGamesResponseSchema,
  type UpdateGameRequest,
  type UpdateGameResponse,
  updateGameRequestSchema,
  updateGameResponseSchema,
} from "../schema/game-schema";
import { matchesSchema } from "./typecheck";

export function isGetGameRequest(data: unknown): data is GetGameRequest {
  return matchesSchema(getGameRequestSchema, data);
}

export function isGetGameResponse(data: unknown): data is GetGameResponse {
  return matchesSchema(getGameResponseSchema, data);
}

export function isListGamesRequest(data: unknown): data is ListGamesRequest {
  return matchesSchema(listGamesRequestSchema, data);
}

export function isListGamesResponse(data: unknown): data is ListGamesResponse {
  return matchesSchema(listGamesResponseSchema, data);
}

export function isCreateGameRequest(data: unknown): data is CreateGameRequest {
  return matchesSchema(createGameRequestSchema, data);
}

export function isCreateGameResponse(data: unknown): data is CreateGameResponse {
  return matchesSchema(createGameResponseSchema, data);
}

export function isUpdateGameRequest(data: unknown): data is UpdateGameRequest {
  return matchesSchema(updateGameRequestSchema, data);
}

export function isUpdateGameResponse(data: unknown): data is UpdateGameResponse {
  return matchesSchema(updateGameResponseSchema, data);
}
