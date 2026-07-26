import { type ApiErrorResponse, apiErrorResponseSchema } from "../schema/api-schema";
import { matchesSchema } from "./typecheck";

export function isApiErrorResponse(data: unknown): data is ApiErrorResponse {
  return matchesSchema(apiErrorResponseSchema, data);
}
