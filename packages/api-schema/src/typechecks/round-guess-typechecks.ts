import {
  type GetRoundGuessesRequest,
  type GetRoundGuessesResponse,
  getRoundGuessesRequestSchema,
  getRoundGuessesResponseSchema,
  type SubmitGuessRequest,
  type SubmitGuessResponse,
  submitGuessRequestSchema,
  submitGuessResponseSchema,
} from "../schema/round-guess-schema";
import { matchesSchema } from "./typecheck";

export function isSubmitGuessRequest(data: unknown): data is SubmitGuessRequest {
  return matchesSchema(submitGuessRequestSchema, data);
}

export function isSubmitGuessResponse(data: unknown): data is SubmitGuessResponse {
  return matchesSchema(submitGuessResponseSchema, data);
}

export function isGetRoundGuessesRequest(data: unknown): data is GetRoundGuessesRequest {
  return matchesSchema(getRoundGuessesRequestSchema, data);
}
export function isGetRoundGuessesResponse(data: unknown): data is GetRoundGuessesResponse {
  return matchesSchema(getRoundGuessesResponseSchema, data);
}
