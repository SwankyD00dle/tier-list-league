import {
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
