import {
  type CreateRoundRequest,
  type CreateRoundResponse,
  createRoundRequestSchema,
  createRoundResponseSchema,
  type GetRoundRequest,
  type GetRoundResponse,
  getRoundRequestSchema,
  getRoundResponseSchema,
  type UpdateRoundRequest,
  type UpdateRoundResponse,
  updateRoundRequestSchema,
  updateRoundResponseSchema,
} from "../schema/round-schema";
import { matchesSchema } from "./typecheck";

export function isGetRoundRequest(data: unknown): data is GetRoundRequest {
  return matchesSchema(getRoundRequestSchema, data);
}

export function isGetRoundResponse(data: unknown): data is GetRoundResponse {
  return matchesSchema(getRoundResponseSchema, data);
}

export function isCreateRoundRequest(data: unknown): data is CreateRoundRequest {
  return matchesSchema(createRoundRequestSchema, data);
}

export function isCreateRoundResponse(data: unknown): data is CreateRoundResponse {
  return matchesSchema(createRoundResponseSchema, data);
}

export function isUpdateRoundRequest(data: unknown): data is UpdateRoundRequest {
  return matchesSchema(updateRoundRequestSchema, data);
}

export function isUpdateRoundResponse(data: unknown): data is UpdateRoundResponse {
  return matchesSchema(updateRoundResponseSchema, data);
}
