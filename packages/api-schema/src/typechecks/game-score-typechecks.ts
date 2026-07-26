import {
  type GetGameScoresRequest,
  type GetGameScoresResponse,
  type GetUserGameScoreRequest,
  type GetUserGameScoreResponse,
  getGameScoresRequestSchema,
  getGameScoresResponseSchema,
  getUserGameScoreRequestSchema,
  getUserGameScoreResponseSchema,
  type RecordGameScoreRequest,
  type RecordGameScoreResponse,
  recordGameScoreRequestSchema,
  recordGameScoreResponseSchema,
} from "../schema/game-score-schema";
import { matchesSchema } from "./typecheck";

export function isRecordGameScoreRequest(data: unknown): data is RecordGameScoreRequest {
  return matchesSchema(recordGameScoreRequestSchema, data);
}

export function isRecordGameScoreResponse(data: unknown): data is RecordGameScoreResponse {
  return matchesSchema(recordGameScoreResponseSchema, data);
}

export function isGetGameScoresRequest(data: unknown): data is GetGameScoresRequest {
  return matchesSchema(getGameScoresRequestSchema, data);
}

export function isGetGameScoresResponse(data: unknown): data is GetGameScoresResponse {
  return matchesSchema(getGameScoresResponseSchema, data);
}

export function isGetUserGameScoreRequest(data: unknown): data is GetUserGameScoreRequest {
  return matchesSchema(getUserGameScoreRequestSchema, data);
}

export function isGetUserGameScoreResponse(data: unknown): data is GetUserGameScoreResponse {
  return matchesSchema(getUserGameScoreResponseSchema, data);
}
